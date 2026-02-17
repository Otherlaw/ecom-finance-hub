/**
 * Cliente SEFAZ para Distribuicao DF-e e Manifestacao do Destinatario
 * Usa SOAP com certificado digital A1 (mutual TLS)
 * 
 * SSL: Carrega CA bundle ICP-Brasil para validacao correta dos certificados SEFAZ
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
import pako from 'pako';
import forge from 'node-forge';
import type { DistDFeResponse, NfeDocument } from './types.js';

// Namespaces XML
const SOAP_ENV = 'http://www.w3.org/2003/05/soap-envelope';
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DIST_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
const EVENTO_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

// Carregar CA bundle ICP-Brasil (se disponivel)
let icpBrasilCA: string | undefined;
const CA_PATHS = [
  path.join(process.cwd(), 'certs', 'icp-brasil.pem'),
  path.join(process.cwd(), 'src', 'certs', 'icp-brasil.pem'),
  '/opt/render/project/src/nfe-worker/certs/icp-brasil.pem',
  path.join(__dirname, '..', 'certs', 'icp-brasil.pem'),
];

for (const caPath of CA_PATHS) {
  try {
    if (fs.existsSync(caPath)) {
      icpBrasilCA = fs.readFileSync(caPath, 'utf8');
      console.log(`[SEFAZ] CA bundle ICP-Brasil carregado de: ${caPath}`);
      break;
    }
  } catch {
    // Continuar tentando outros caminhos
  }
}

if (!icpBrasilCA) {
  console.warn('[SEFAZ] AVISO: CA bundle ICP-Brasil nao encontrado. SSL pode falhar.');
  console.warn('[SEFAZ] Configure NODE_EXTRA_CA_CERTS ou adicione certs/icp-brasil.pem');
}

export class SefazClient {
  private pfxBuffer: Buffer;
  private passphrase: string;
  private ambiente: 'producao' | 'homologacao';
  private uf: string;

  constructor(pfxBase64: string, passphrase: string, ambiente: 'producao' | 'homologacao', uf: string) {
    this.pfxBuffer = Buffer.from(pfxBase64, 'base64');
    this.passphrase = passphrase;
    this.ambiente = ambiente;
    this.uf = uf;
  }

  /**
   * Retorna codigo IBGE da UF
   */
  private getCodigoUF(uf: string): string {
    const codigos: Record<string, string> = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29',
      'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
      'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
      'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
      'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
      'SE': '28', 'TO': '17',
    };
    return codigos[uf.toUpperCase()] || '35';
  }

  /**
   * Retorna URL do servico de Distribuicao baseado no ambiente
   */
  private getDistribuicaoUrl(): string {
    if (this.ambiente === 'producao') {
      return 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
    }
    return 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  }

  /**
   * Retorna URL do servico de RecepcaoEvento baseado no ambiente (Ambiente Nacional)
   */
  private getRecepcaoEventoUrl(): string {
    if (this.ambiente === 'producao') {
      return 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
    }
    return 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
  }

  /**
   * Extrai chave privada e certificado PEM do PFX
   */
  private extractPemFromPfx(): { privateKey: string; certificate: string; certDer: string; caList: string[] } {
    const p12Asn1 = forge.asn1.fromDer(this.pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.passphrase);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    const certBag = certBags[forge.pki.oids.certBag];

    if (!keyBag || !keyBag[0] || !certBag || !certBag[0]) {
      throw new Error('Certificado PFX invalido ou senha incorreta');
    }

    const privateKey = forge.pki.privateKeyToPem(keyBag[0].key!);
    const certificate = forge.pki.certificateToPem(certBag[0].cert!);

    // Extrair certificado DER em base64 (para Signature/X509Certificate)
    const certAsn1 = forge.pki.certificateToAsn1(certBag[0].cert!);
    const certDer = forge.asn1.toDer(certAsn1).getBytes();
    const certDerB64 = forge.util.encode64(certDer);

    // CAs do PFX
    const caList: string[] = [];
    for (let i = 1; i < certBag.length; i++) {
      if (certBag[i].cert) {
        caList.push(forge.pki.certificateToPem(certBag[i].cert!));
      }
    }

    return { privateKey, certificate, certDer: certDerB64, caList };
  }

  /**
   * Cria agente HTTPS com certificado para mutual TLS
   */
  /**
   * Cria agente HTTPS com certificado para mutual TLS
   * Usa PFX diretamente via Node.js/OpenSSL — NÃO usa node-forge
   */
  private createHttpsAgent(): https.Agent {
    console.log('[SEFAZ] Criando agente HTTPS com PFX direto (Node.js/OpenSSL)');
    
    return new https.Agent({
      pfx: this.pfxBuffer,
      passphrase: this.passphrase,
      ca: icpBrasilCA ? [icpBrasilCA] : undefined,
      rejectUnauthorized: !!icpBrasilCA,
    });
  }

  /**
   * Monta envelope SOAP para consulta de distribuicao
   */
  private buildDistDFeRequest(cnpj: string, ultNSU: number): string {
    const tpAmb = this.ambiente === 'producao' ? '1' : '2';
    const nsu = ultNSU.toString().padStart(15, '0');
    const cUFAutor = this.getCodigoUF(this.uf);

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="${SOAP_ENV}" xmlns:nfe="${DIST_NS}">
  <soap12:Body>
    <nfe:nfeDistDFeInteresse>
      <nfe:nfeDadosMsg>
        <distDFeInt xmlns="${NFE_NS}" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsu}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfe:nfeDadosMsg>
    </nfe:nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
  }

  /**
   * Faz requisicao SOAP generica com tratamento de erros SSL
   */
  private async soapRequest(url: string, envelope: string, soapAction: string): Promise<string> {
    const parsedUrl = new URL(url);

    let agent: https.Agent;
    try {
      agent = this.createHttpsAgent();
    } catch (err) {
      console.error('[SEFAZ] Erro ao criar agente HTTPS:', err);
      throw err;
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname,
          method: 'POST',
          agent,
          headers: {
            'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
            'Content-Length': Buffer.byteLength(envelope, 'utf8'),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );

      req.on('error', (err) => {
        if (err.message.includes('unable to get local issuer certificate') ||
            err.message.includes('self signed certificate') ||
            err.message.includes('certificate')) {
          console.warn('[SEFAZ] Erro SSL, tentando sem validacao:', err.message);
          this.soapRequestFallback(url, envelope, soapAction).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      req.write(envelope);
      req.end();
    });
  }

  /**
   * Fallback: requisicao SOAP sem validacao SSL
   */
  private async soapRequestFallback(url: string, envelope: string, soapAction: string): Promise<string> {
    const parsedUrl = new URL(url);
    const { privateKey, certificate } = this.extractPemFromPfx();

    const agent = new https.Agent({
      key: privateKey,
      cert: certificate,
      rejectUnauthorized: false,
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname,
          method: 'POST',
          agent,
          headers: {
            'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
            'Content-Length': Buffer.byteLength(envelope, 'utf8'),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );

      req.on('error', reject);
      req.write(envelope);
      req.end();
    });
  }

  /**
   * Parseia resposta SOAP da Distribuicao e extrai documentos
   */
  private async parseDistResponse(xml: string): Promise<DistDFeResponse> {
    const result = await parseStringPromise(xml, { explicitArray: false });

    const body = result['soap:Envelope']?.['soap:Body'] || 
                 result['soap12:Envelope']?.['soap12:Body'];

    if (!body) {
      console.error('[SEFAZ] Resposta SOAP invalida:', xml.substring(0, 500));
      throw new Error('Resposta SOAP invalida');
    }

    const nfeResponse = body['nfeDistDFeInteresseResponse']?.['nfeDistDFeInteresseResult']?.['retDistDFeInt'];

    if (!nfeResponse) {
      console.error('[SEFAZ] Resposta da SEFAZ invalida:', JSON.stringify(body).substring(0, 500));
      throw new Error('Resposta da SEFAZ invalida');
    }

    const cStat = nfeResponse.cStat;
    const xMotivo = nfeResponse.xMotivo;

    if (cStat === '656') {
      console.error(`[SEFAZ] Erro 656 - Consumo Indevido: ${xMotivo}`);
      throw new Error(`Erro SEFAZ 656: Consumo Indevido - ${xMotivo}`);
    }

    if (cStat !== '138' && cStat !== '137') {
      console.error(`[SEFAZ] Erro ${cStat}: ${xMotivo}`);
      throw new Error(`Erro SEFAZ: ${cStat} - ${xMotivo}`);
    }

    const docZip: DistDFeResponse['docZip'] = [];

    const loteDistDFeInt = nfeResponse.loteDistDFeInt;
    if (loteDistDFeInt?.docZip) {
      const docs = Array.isArray(loteDistDFeInt.docZip) 
        ? loteDistDFeInt.docZip 
        : [loteDistDFeInt.docZip];

      for (const doc of docs) {
        docZip.push({
          NSU: doc.$.NSU,
          schema: doc.$.schema,
          content: doc._,
        });
      }
    }

    return {
      cStat,
      xMotivo,
      ultNSU: parseInt(nfeResponse.ultNSU) || 0,
      maxNSU: parseInt(nfeResponse.maxNSU) || 0,
      docZip,
    };
  }

  /**
   * Descompacta e decodifica documento GZIP da SEFAZ
   * A SEFAZ envia pacotes em formato GZIP (não ZLIB puro)
   */
  private unzipDocument(base64Content: string): string {
    const compressed = Buffer.from(base64Content, 'base64');
    const uint8 = new Uint8Array(compressed);

    // Tentar GZIP primeiro (formato padrão SEFAZ)
    try {
      const decompressed = pako.ungzip(uint8);
      return Buffer.from(decompressed).toString('utf-8');
    } catch (gzipError) {
      // Fallback: tentar inflate (ZLIB) caso não seja GZIP
      try {
        const decompressed = pako.inflate(uint8);
        return Buffer.from(decompressed).toString('utf-8');
      } catch (inflateError) {
        console.error('[SEFAZ] Falha ao descompactar documento (tentou ungzip e inflate):', gzipError);
        throw new Error(`Falha na descompactacao: ${gzipError instanceof Error ? gzipError.message : String(gzipError)}`);
      }
    }
  }

  /**
   * Consulta Distribuicao DF-e
   * IMPORTANTE: Mesmo que documentos individuais falhem ao descompactar,
   * a funcao SEMPRE retorna ultNSU/maxNSU para evitar travar o loop e causar erro 656.
   */
  async consultarDistribuicao(cnpj: string, ultNSU: number): Promise<{
    documents: NfeDocument[];
    ultNSU: number;
    maxNSU: number;
    hasMore: boolean;
  }> {
    console.log(`[SEFAZ] Consultando NSU ${ultNSU} para CNPJ ${cnpj}`);

    const url = this.getDistribuicaoUrl();
    const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
    const envelope = this.buildDistDFeRequest(cnpj, ultNSU);
    const responseXml = await this.soapRequest(url, envelope, soapAction);
    const response = await this.parseDistResponse(responseXml);

    const documents: NfeDocument[] = [];

    for (const doc of response.docZip) {
      try {
        const xml = this.unzipDocument(doc.content);
        const nsu = parseInt(doc.NSU);

        // Extrair chave de acesso do XML
        let accessKey = '';
        const match = xml.match(/Id="NFe(\d{44})"/);
        if (match) {
          accessKey = match[1];
        } else {
          const chaveMatch = xml.match(/<chNFe>(\d{44})<\/chNFe>/);
          if (chaveMatch) {
            accessKey = chaveMatch[1];
          }
        }

        documents.push({
          access_key: accessKey,
          nsu,
          schema: doc.schema,
          xml: doc.schema === 'procNFe_v4.00' || doc.schema.includes('procNFe') ? xml : undefined,
        });
      } catch (docError) {
        // Logar erro mas NAO interromper o loop - avançar para o próximo documento
        console.error(`[SEFAZ] Erro ao processar doc NSU=${doc.NSU} schema=${doc.schema}: ${docError instanceof Error ? docError.message : String(docError)}`);
        // Mesmo com erro, registrar o doc com dados mínimos para não perder o NSU
        documents.push({
          access_key: '',
          nsu: parseInt(doc.NSU),
          schema: doc.schema,
          xml: undefined,
        });
      }
    }

    console.log(`[SEFAZ] Recebidos ${documents.length} documentos (${response.docZip.length} no lote), ultNSU=${response.ultNSU}, maxNSU=${response.maxNSU}`);

    return {
      documents,
      ultNSU: response.ultNSU,
      maxNSU: response.maxNSU,
      hasMore: response.ultNSU < response.maxNSU,
    };
  }

  // ====================================================================
  // MANIFESTAÇÃO DO DESTINATÁRIO - Ciência da Operação (evento 210210)
  // ====================================================================

  /**
   * Assina um nó XML com XML-DSig (RSA-SHA1 / Enveloped Signature)
   * usando a chave privada do certificado A1.
   */
  private signXml(xmlContent: string, referenceUri: string): string {
    let privateKey: string;
    let certDer: string;
    try {
      const extracted = this.extractPemFromPfx();
      privateKey = extracted.privateKey;
      certDer = extracted.certDer;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SEFAZ] node-forge não suporta este PFX para assinatura XML: ${errMsg}`);
      throw new Error(`Certificado PFX não suportado para assinatura XML (node-forge). Considere converter o certificado para formato compatível. Erro: ${errMsg}`);
    }

    // 1. Canonicalizar o conteúdo (C14N simples: remover declaração XML, normalizar whitespace)
    // Para simplificação, usamos o XML como está e computamos o digest
    const digestInput = xmlContent;

    // 2. Calcular SHA-1 digest do nó referenciado
    const sha1Digest = crypto.createHash('sha1').update(digestInput, 'utf8').digest('base64');

    // 3. Montar SignedInfo
    const signedInfo = 
      `<SignedInfo xmlns="${XMLDSIG_NS}">` +
        `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
        `<Reference URI="#${referenceUri}">` +
          `<Transforms>` +
            `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
            `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
          `</Transforms>` +
          `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
          `<DigestValue>${sha1Digest}</DigestValue>` +
        `</Reference>` +
      `</SignedInfo>`;

    // 4. Assinar SignedInfo com RSA-SHA1
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(signedInfo);
    const signatureValue = sign.sign(privateKey, 'base64');

    // 5. Montar bloco Signature completo
    const signature = 
      `<Signature xmlns="${XMLDSIG_NS}">` +
        signedInfo +
        `<SignatureValue>${signatureValue}</SignatureValue>` +
        `<KeyInfo>` +
          `<X509Data>` +
            `<X509Certificate>${certDer}</X509Certificate>` +
          `</X509Data>` +
        `</KeyInfo>` +
      `</Signature>`;

    return signature;
  }

  /**
   * Envia Manifestação do Destinatário - Ciência da Operação (evento 210210)
   * 
   * @param cnpj CNPJ do destinatário (empresa)
   * @param chaveAcesso Chave de acesso da NF-e (44 dígitos)
   * @returns true se evento registrado com sucesso (cStat 135 ou 573)
   */
  async manifestarCiencia(cnpj: string, chaveAcesso: string): Promise<boolean> {
    if (!chaveAcesso || chaveAcesso.length !== 44) {
      console.warn(`[SEFAZ-MANIF] Chave de acesso invalida: "${chaveAcesso}"`);
      return false;
    }

    const tpAmb = this.ambiente === 'producao' ? '1' : '2';
    const cOrgao = '91'; // Ambiente Nacional
    const dhEvento = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
    const nSeqEvento = '1';
    const eventId = `ID210210${chaveAcesso}${nSeqEvento.padStart(2, '0')}`;

    // Montar XML do evento (sem assinatura ainda)
    const eventoXml = 
      `<evento xmlns="${NFE_NS}" versao="1.00">` +
        `<infEvento Id="${eventId}">` +
          `<cOrgao>${cOrgao}</cOrgao>` +
          `<tpAmb>${tpAmb}</tpAmb>` +
          `<CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>` +
          `<chNFe>${chaveAcesso}</chNFe>` +
          `<dhEvento>${dhEvento}</dhEvento>` +
          `<tpEvento>210210</tpEvento>` +
          `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
          `<verEvento>1.00</verEvento>` +
          `<detEvento versao="1.00">` +
            `<descEvento>Ciencia da Operacao</descEvento>` +
          `</detEvento>` +
        `</infEvento>` +
      `</evento>`;

    // Conteúdo do infEvento para assinatura (o nó referenciado)
    const infEventoXml = 
      `<infEvento Id="${eventId}">` +
        `<cOrgao>${cOrgao}</cOrgao>` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>` +
        `<chNFe>${chaveAcesso}</chNFe>` +
        `<dhEvento>${dhEvento}</dhEvento>` +
        `<tpEvento>210210</tpEvento>` +
        `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        `<detEvento versao="1.00">` +
          `<descEvento>Ciencia da Operacao</descEvento>` +
        `</detEvento>` +
      `</infEvento>`;

    // Assinar
    const signature = this.signXml(infEventoXml, eventId);

    // Montar evento assinado (Signature dentro de <evento>, após </infEvento>)
    const eventoAssinado = 
      `<evento xmlns="${NFE_NS}" versao="1.00">` +
        infEventoXml +
        signature +
      `</evento>`;

    // Montar envelope SOAP
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="${SOAP_ENV}" xmlns:nfe="${EVENTO_NS}">
  <soap12:Body>
    <nfe:nfeRecepcaoEvento>
      <nfe:nfeDadosMsg>
        <envEvento xmlns="${NFE_NS}" versao="1.00">
          <idLote>1</idLote>
          ${eventoAssinado}
        </envEvento>
      </nfe:nfeDadosMsg>
    </nfe:nfeRecepcaoEvento>
  </soap12:Body>
</soap12:Envelope>`;

    console.log(`[SEFAZ-MANIF] Enviando Ciencia da Operacao para chave ${chaveAcesso}`);

    const url = this.getRecepcaoEventoUrl();
    const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

    const responseXml = await this.soapRequest(url, envelope, soapAction);

    // Parsear resposta
    const result = await parseStringPromise(responseXml, { explicitArray: false });
    const body = result['soap:Envelope']?.['soap:Body'] || 
                 result['soap12:Envelope']?.['soap12:Body'];

    if (!body) {
      console.error('[SEFAZ-MANIF] Resposta SOAP invalida:', responseXml.substring(0, 500));
      throw new Error('Resposta SOAP de manifestacao invalida');
    }

    // Navegar até o retorno do evento
    const retEnvEvento = body['nfeRecepcaoEventoResponse']?.['nfeRecepcaoEventoResult']?.['retEnvEvento'] ||
                         body['nfeRecepcaoEventoNFResult']?.['retEnvEvento'];

    if (!retEnvEvento) {
      // Tentar extrair cStat do nível do envelope
      console.error('[SEFAZ-MANIF] Estrutura de resposta inesperada:', JSON.stringify(body).substring(0, 500));
      throw new Error('Estrutura de resposta de manifestacao inesperada');
    }

    // O cStat do lote
    const cStatLote = retEnvEvento.cStat;
    const xMotivoLote = retEnvEvento.xMotivo;

    // Verificar resultado individual do evento
    const retEvento = retEnvEvento.retEvento;
    if (retEvento) {
      const infEvento = retEvento.infEvento || retEvento;
      const cStat = infEvento.cStat;
      const xMotivo = infEvento.xMotivo;

      console.log(`[SEFAZ-MANIF] Resultado: cStat=${cStat} - ${xMotivo} (lote: ${cStatLote})`);

      // 135 = Evento registrado e vinculado à NF-e
      // 573 = Duplicidade de Evento (já manifestou antes - OK)
      if (cStat === '135' || cStat === '573') {
        return true;
      }

      console.warn(`[SEFAZ-MANIF] Evento rejeitado: ${cStat} - ${xMotivo}`);
      return false;
    }

    console.log(`[SEFAZ-MANIF] Resultado do lote: cStat=${cStatLote} - ${xMotivoLote}`);
    
    // 128 = Lote de Evento processado
    if (cStatLote === '128') {
      return true;
    }

    return false;
  }
}
