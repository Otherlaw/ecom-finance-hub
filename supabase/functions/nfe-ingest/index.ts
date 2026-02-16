/**
 * NFe Ingest Edge Function
 * Recebe lotes de documentos NF-e do worker externo e processa para gerar creditos de ICMS
 * 
 * Autenticacao: header x-worker-token comparado com secret WORKER_INGEST_TOKEN
 * 
 * Filtro de data: apenas docs dos ultimos 90 dias sao importados com XML/creditos
 * Docs mais antigos sao registrados apenas para controle de NSU
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
};

// Janela de sincronizacao em dias
const SYNC_WINDOW_DAYS = 7;

interface NFeDocument {
  access_key: string;
  nsu: number;
  schema: string;
  xml?: string;
}

interface IngestPayload {
  empresa_id: string;
  documents: NFeDocument[];
}

interface NFeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  aliquotaIcms: number;
  valorIcms: number;
  ufOrigem: string;
}

interface ParsedNFe {
  chaveAcesso: string;
  numero: string;
  dataEmissao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    uf: string;
  };
  destinatario: {
    cnpj: string;
  };
  itens: NFeItem[];
  valorTotal: number;
}

// Calcula data de corte (90 dias atras)
function getCutoffDate(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SYNC_WINDOW_DAYS);
  return cutoff.toISOString().split("T")[0]; // YYYY-MM-DD
}

// Parser simplificado de XML NF-e para Deno (sem DOMParser)
function parseNFeXML(xmlContent: string): ParsedNFe | null {
  try {
    const getTagValue = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
      const match = xml.match(regex);
      return match ? match[1].trim() : "";
    };

    const getNestedTagValue = (xml: string, parent: string, tag: string): string => {
      const parentRegex = new RegExp(`<${parent}[^>]*>([\\s\\S]*?)</${parent}>`, "i");
      const parentMatch = xml.match(parentRegex);
      if (!parentMatch) return "";
      return getTagValue(parentMatch[1], tag);
    };

    // Extrai chave de acesso
    const infNFeMatch = xmlContent.match(/Id="NFe(\d{44})"/);
    const chaveAcesso = infNFeMatch ? infNFeMatch[1] : "";

    if (!chaveAcesso) {
      console.error("Chave de acesso nao encontrada no XML");
      return null;
    }

    // Dados basicos da NF-e
    const numero = getTagValue(xmlContent, "nNF");
    
    // Extrai data de emissao (dhEmi ou dEmi)
    let dataEmissao = getTagValue(xmlContent, "dhEmi");
    if (!dataEmissao) {
      dataEmissao = getTagValue(xmlContent, "dEmi");
    }
    // Normaliza para YYYY-MM-DD
    dataEmissao = dataEmissao.substring(0, 10);

    // Emitente
    const emitMatch = xmlContent.match(/<emit>([\s\S]*?)<\/emit>/i);
    const emitXml = emitMatch ? emitMatch[1] : "";
    const emitCnpj = getTagValue(emitXml, "CNPJ");
    const emitRazaoSocial = getTagValue(emitXml, "xNome");
    const emitUf = getNestedTagValue(emitXml, "enderEmit", "UF");

    // Destinatario
    const destMatch = xmlContent.match(/<dest>([\s\S]*?)<\/dest>/i);
    const destXml = destMatch ? destMatch[1] : "";
    const destCnpj = getTagValue(destXml, "CNPJ");

    // Itens
    const itens: NFeItem[] = [];
    const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/gi;
    let detMatch;

    while ((detMatch = detRegex.exec(xmlContent)) !== null) {
      const detXml = detMatch[1];
      
      const prodMatch = detXml.match(/<prod>([\s\S]*?)<\/prod>/i);
      const prodXml = prodMatch ? prodMatch[1] : "";

      const icmsMatch = detXml.match(/<ICMS>([\s\S]*?)<\/ICMS>/i);
      const icmsXml = icmsMatch ? icmsMatch[1] : "";
      
      const aliquotaIcms = parseFloat(getTagValue(icmsXml, "pICMS") || "0");
      const valorIcms = parseFloat(getTagValue(icmsXml, "vICMS") || "0");

      const item: NFeItem = {
        codigo: getTagValue(prodXml, "cProd"),
        descricao: getTagValue(prodXml, "xProd"),
        ncm: getTagValue(prodXml, "NCM"),
        cfop: getTagValue(prodXml, "CFOP"),
        quantidade: parseFloat(getTagValue(prodXml, "qCom") || "0"),
        valorUnitario: parseFloat(getTagValue(prodXml, "vUnCom") || "0"),
        valorTotal: parseFloat(getTagValue(prodXml, "vProd") || "0"),
        aliquotaIcms,
        valorIcms,
        ufOrigem: emitUf,
      };

      itens.push(item);
    }

    const valorTotal = parseFloat(getTagValue(xmlContent, "vNF") || "0");

    return {
      chaveAcesso,
      numero,
      dataEmissao,
      emitente: {
        cnpj: emitCnpj,
        razaoSocial: emitRazaoSocial,
        uf: emitUf,
      },
      destinatario: {
        cnpj: destCnpj,
      },
      itens,
      valorTotal,
    };
  } catch (error) {
    console.error("Erro ao parsear XML:", error);
    return null;
  }
}

// Determina tipo de credito baseado no regime tributario
async function getEmpresaTipoCredito(
  supabaseUrl: string,
  serviceKey: string,
  empresaId: string
): Promise<"compensavel" | "nao_compensavel"> {
  const client = createClient(supabaseUrl, serviceKey);
  const { data: empresa } = await client
    .from("empresas")
    .select("regime_tributario")
    .eq("id", empresaId)
    .single();

  if (!empresa) return "compensavel";
  const regimeTributario = (empresa as { regime_tributario: string }).regime_tributario;
  return regimeTributario === "simples_nacional" ? "nao_compensavel" : "compensavel";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar token do worker
    const workerToken = req.headers.get("x-worker-token");
    const expectedToken = Deno.env.get("WORKER_INGEST_TOKEN");

    if (!workerToken || workerToken !== expectedToken) {
      console.error("Token de autenticacao invalido");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    const payload: IngestPayload = await req.json();

    if (!payload.empresa_id || !payload.documents || !Array.isArray(payload.documents)) {
      return new Response(
        JSON.stringify({ error: "Payload invalido. Esperado: { empresa_id, documents[] }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalInBatch = payload.documents.length;
    console.log(`Processando ${totalInBatch} documentos para empresa ${payload.empresa_id}`);

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar chaves existentes para evitar duplicidade
    const { data: existingDocs } = await supabase
      .from("nfe_documents")
      .select("access_key")
      .eq("empresa_id", payload.empresa_id);

    const existingKeys = new Set(existingDocs?.map((d) => d.access_key) || []);

    // Tipo de credito para a empresa
    const tipoCredito = await getEmpresaTipoCredito(supabaseUrl, supabaseServiceKey, payload.empresa_id);

    // Data de corte (ultimos 90 dias)
    const cutoffDate = getCutoffDate();
    console.log(`Cutoff date: ${cutoffDate} (docs mais antigos serao registrados sem XML/creditos)`);

    let inserted = 0;
    let duplicates = 0;
    let creditsCreated = 0;
    let skippedOldDocs = 0;
    let skippedNoXml = 0;
    const errors: string[] = [];

    for (const doc of payload.documents) {
      // Verificar duplicidade
      if (existingKeys.has(doc.access_key)) {
        duplicates++;
        continue;
      }

      // Apenas processa XMLs completos (procNFe em qualquer versao)
      const isProcNFe = doc.schema?.includes('procNFe') || doc.schema === 'procNFe';
      
      if (!isProcNFe || !doc.xml) {
        // Documento sem XML completo (resumo/evento) - salva referencia apenas
        await supabase.from("nfe_documents").insert({
          empresa_id: payload.empresa_id,
          access_key: doc.access_key,
          nsu: doc.nsu,
          schema_type: doc.schema,
          processed: true, // Marca como processado para nao reprocessar
        });
        skippedNoXml++;
        existingKeys.add(doc.access_key);
        continue;
      }

      // Parse XML
      const nfe = parseNFeXML(doc.xml);
      if (!nfe) {
        errors.push(`Falha ao parsear XML: ${doc.access_key}`);
        // Mesmo com erro, registra para nao reprocessar
        await supabase.from("nfe_documents").insert({
          empresa_id: payload.empresa_id,
          access_key: doc.access_key,
          nsu: doc.nsu,
          schema_type: doc.schema,
          processed: true,
        });
        existingKeys.add(doc.access_key);
        continue;
      }

      // FILTRO DE DATA: docs mais antigos que cutoff
      const docDate = nfe.dataEmissao;
      if (docDate && docDate < cutoffDate) {
        skippedOldDocs++;
        console.log(`Doc ${doc.access_key.substring(0,15)}... ignorado (emissao: ${docDate} < cutoff: ${cutoffDate})`);
        
        // Salva referencia para controle de NSU, sem XML nem creditos
        await supabase.from("nfe_documents").insert({
          empresa_id: payload.empresa_id,
          access_key: doc.access_key,
          nsu: doc.nsu,
          schema_type: doc.schema,
          issue_date: docDate,
          total_value: nfe.valorTotal,
          processed: true,
        });
        existingKeys.add(doc.access_key);
        continue;
      }

      // Documento dentro da janela de 90 dias - importar completo
      console.log(`Doc ${doc.access_key.substring(0,15)}... importando (emissao: ${docDate})`);
      
      const { data: insertedDoc, error: docError } = await supabase
        .from("nfe_documents")
        .insert({
          empresa_id: payload.empresa_id,
          access_key: doc.access_key,
          nsu: doc.nsu,
          schema_type: doc.schema,
          xml_content: doc.xml,
          issuer_cnpj: nfe.emitente.cnpj,
          dest_cnpj: nfe.destinatario.cnpj,
          issue_date: nfe.dataEmissao || null,
          total_value: nfe.valorTotal,
          processed: false,
        })
        .select()
        .single();

      if (docError) {
        errors.push(`Erro ao inserir documento ${doc.access_key}: ${docError.message}`);
        continue;
      }

      inserted++;
      existingKeys.add(doc.access_key);

      // Gerar creditos de ICMS para itens com ICMS destacado
      const creditos = [];
      const dataCompetencia = nfe.dataEmissao ? nfe.dataEmissao.substring(0, 7) : new Date().toISOString().substring(0, 7);

      for (const item of nfe.itens) {
        creditos.push({
          empresa_id: payload.empresa_id,
          tipo_credito: tipoCredito,
          origem_credito: "compra_mercadoria",
          status_credito: "ativo",
          chave_acesso: nfe.chaveAcesso,
          numero_nf: nfe.numero,
          ncm: item.ncm || "",
          cfop: item.cfop,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          valor_total: item.valorTotal,
          uf_origem: item.ufOrigem,
          aliquota_icms: item.aliquotaIcms,
          valor_icms_destacado: item.valorIcms,
          percentual_aproveitamento: 100,
          valor_credito_bruto: item.valorIcms,
          valor_ajustes: 0,
          valor_credito: item.valorIcms,
          data_lancamento: new Date().toISOString().split("T")[0],
          data_competencia: dataCompetencia,
          fornecedor_nome: nfe.emitente.razaoSocial,
          observacoes: "Importado automaticamente via Distribuicao DF-e",
          origin: "nfe_sync",
          nfe_document_id: insertedDoc.id,
        });
      }

      if (creditos.length > 0) {
        const { error: creditError } = await supabase
          .from("creditos_icms")
          .insert(creditos);

        if (creditError) {
          errors.push(`Erro ao criar creditos para ${doc.access_key}: ${creditError.message}`);
        } else {
          creditsCreated += creditos.length;
          
          await supabase
            .from("nfe_documents")
            .update({ processed: true, credits_generated: creditos.length })
            .eq("id", insertedDoc.id);
        }
      }
    }

    // Log da operacao
    await supabase.from("nfe_sync_logs").insert({
      empresa_id: payload.empresa_id,
      level: errors.length > 0 ? "warn" : "info",
      message: `Lote: ${inserted} importados, ${skippedOldDocs} antigos, ${skippedNoXml} sem XML, ${duplicates} duplicados, ${creditsCreated} creditos`,
      meta: { 
        total_in_batch: totalInBatch,
        inserted, 
        duplicates, 
        skipped_old: skippedOldDocs,
        skipped_no_xml: skippedNoXml,
        credits_created: creditsCreated, 
        errors,
        cutoff_date: cutoffDate,
      },
    });

    const response = {
      success: true,
      inserted,
      duplicates,
      skipped_old: skippedOldDocs,
      skipped_no_xml: skippedNoXml,
      total_in_batch: totalInBatch,
      credits_created: creditsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Ingestao concluida:", JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro na ingestao:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
