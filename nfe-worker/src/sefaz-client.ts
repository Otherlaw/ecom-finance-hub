/**
 * Cliente SEFAZ para Distribuicao DF-e
 * Usa SOAP com certificado digital A1 (mutual TLS)
 */

import https from 'https';
import { parseStringPromise } from 'xml2js';
import pako from 'pako';
import forge from 'node-forge';
import type { DistDFeResponse, NfeDocument } from './types.js';

// Namespaces XML
const SOAP_ENV = 'http://www.w3.org/2003/05/soap-envelope';
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DIST_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';

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
    return codigos[uf.toUpperCase()] || '35'; // Default SP
  }

  /**
   * Retorna URL do servico baseado no ambiente
   */
  private getServiceUrl(): string {
    // Ambiente Nacional (AN) - usado para Distribuicao DF-e
    if (this.ambiente === 'producao') {
      return 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
    }
    return 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  }

  /**
   * Cria agente HTTPS com certificado para mutual TLS
   */
  private createHttpsAgent(): https.Agent {
    // Parsear PFX usando node-forge
    const p12Asn1 = forge.asn1.fromDer(this.pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.passphrase);

    // Extrair chave e certificados
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    const certBag = certBags[forge.pki.oids.certBag];

    if (!keyBag || !keyBag[0] || !certBag || !certBag[0]) {
      throw new Error('Certificado PFX invalido ou senha incorreta');
    }

    const privateKey = forge.pki.privateKeyToPem(keyBag[0].key!);
    const certificate = forge.pki.certificateToPem(certBag[0].cert!);

    // Certificados CA (chain)
    const ca: string[] = [];
    for (let i = 1; i < certBag.length; i++) {
      if (certBag[i].cert) {
        ca.push(forge.pki.certificateToPem(certBag[i].cert!));
      }
    }

    // NOTA: rejectUnauthorized=false é necessário porque o Render não tem
    // os certificados raiz da ICP-Brasil instalados. Em produção com servidor
    // próprio, recomenda-se instalar os CAs e usar rejectUnauthorized=true.
    return new https.Agent({
      key: privateKey,
      cert: certificate,
      ca: ca.length > 0 ? ca : undefined,
      rejectUnauthorized: false, // Necessário para ambientes cloud sem CAs ICP-Brasil
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
   * Faz requisicao SOAP
   */
  private async soapRequest(envelope: string): Promise<string> {
    const url = new URL(this.getServiceUrl());
    const agent = this.createHttpsAgent();

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'POST',
          agent,
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Content-Length': Buffer.byteLength(envelope, 'utf8'),
            SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
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
   * Parseia resposta SOAP e extrai documentos
   */
  private async parseResponse(xml: string): Promise<DistDFeResponse> {
    const result = await parseStringPromise(xml, { explicitArray: false });

    // Navegar pela estrutura SOAP
    const body = result['soap:Envelope']?.['soap:Body'] || 
                 result['soap12:Envelope']?.['soap12:Body'];
    
    if (!body) {
      throw new Error('Resposta SOAP invalida');
    }

    const nfeResponse = body['nfeDistDFeInteresseResponse']?.['nfeDistDFeInteresseResult']?.['retDistDFeInt'];
    
    if (!nfeResponse) {
      throw new Error('Resposta da SEFAZ invalida');
    }

    const cStat = nfeResponse.cStat;
    const xMotivo = nfeResponse.xMotivo;

    if (cStat !== '138' && cStat !== '137') {
      // 138 = Documentos localizados
      // 137 = Nenhum documento localizado
      throw new Error(`Erro SEFAZ: ${cStat} - ${xMotivo}`);
    }

    const docZip: DistDFeResponse['docZip'] = [];

    // Processar documentos
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
   * Descompacta e decodifica documento
   */
  private unzipDocument(base64Content: string): string {
    const compressed = Buffer.from(base64Content, 'base64');
    const decompressed = pako.inflate(compressed);
    return new TextDecoder('utf-8').decode(decompressed);
  }

  /**
   * Consulta Distribuicao DF-e
   */
  async consultarDistribuicao(cnpj: string, ultNSU: number): Promise<{
    documents: NfeDocument[];
    ultNSU: number;
    maxNSU: number;
    hasMore: boolean;
  }> {
    console.log(`[SEFAZ] Consultando NSU ${ultNSU} para CNPJ ${cnpj}`);

    const envelope = this.buildDistDFeRequest(cnpj, ultNSU);
    const responseXml = await this.soapRequest(envelope);
    const response = await this.parseResponse(responseXml);

    const documents: NfeDocument[] = [];

    for (const doc of response.docZip) {
      const xml = this.unzipDocument(doc.content);
      const nsu = parseInt(doc.NSU);

      // Extrair chave de acesso do XML
      let accessKey = '';
      const match = xml.match(/Id="NFe(\d{44})"/);
      if (match) {
        accessKey = match[1];
      } else {
        // Tentar extrair de resNFe ou resEvento
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
    }

    console.log(`[SEFAZ] Recebidos ${documents.length} documentos, ultNSU=${response.ultNSU}, maxNSU=${response.maxNSU}`);

    return {
      documents,
      ultNSU: response.ultNSU,
      maxNSU: response.maxNSU,
      hasMore: response.ultNSU < response.maxNSU,
    };
  }
}
