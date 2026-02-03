/**
 * NFe Ingest Edge Function
 * Recebe lotes de documentos NF-e do worker externo e processa para gerar creditos de ICMS
 * 
 * Autenticacao: header x-worker-token comparado com secret WORKER_INGEST_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
};

interface NFeDocument {
  access_key: string;
  nsu: number;
  schema: string;
  xml: string;
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

// Parser simplificado de XML NF-e para Deno (sem DOMParser)
function parseNFeXML(xmlContent: string): ParsedNFe | null {
  try {
    // Extrai campos usando regex (simplificado para Edge Function)
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
    const dataEmissao = getTagValue(xmlContent, "dhEmi").substring(0, 10);

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
      
      // Produto
      const prodMatch = detXml.match(/<prod>([\s\S]*?)<\/prod>/i);
      const prodXml = prodMatch ? prodMatch[1] : "";

      // ICMS - procura em qualquer grupo ICMS
      const icmsMatch = detXml.match(/<ICMS>([\s\S]*?)<\/ICMS>/i);
      const icmsXml = icmsMatch ? icmsMatch[1] : "";
      
      // Procura valores de ICMS em qualquer subgrupo
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

    // Valor total
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
  // Handle CORS preflight
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

    console.log(`Processando ${payload.documents.length} documentos para empresa ${payload.empresa_id}`);

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

    let inserted = 0;
    let duplicates = 0;
    let creditsCreated = 0;
    const errors: string[] = [];

    for (const doc of payload.documents) {
      // Verificar duplicidade
      if (existingKeys.has(doc.access_key)) {
        duplicates++;
        continue;
      }

      // Apenas processa XMLs completos (procNFe em qualquer versão)
      const isProcNFe = doc.schema?.includes('procNFe') || doc.schema === 'procNFe';
      
      if (!isProcNFe || !doc.xml) {
        // Salva referencia do documento mesmo sem XML completo
        await supabase.from("nfe_documents").insert({
          empresa_id: payload.empresa_id,
          access_key: doc.access_key,
          nsu: doc.nsu,
          schema_type: doc.schema,
          processed: false,
        });
        inserted++;
        existingKeys.add(doc.access_key);
        continue;
      }

      // Parse XML
      const nfe = parseNFeXML(doc.xml);
      if (!nfe) {
        errors.push(`Falha ao parsear XML: ${doc.access_key}`);
        continue;
      }

      // Inserir documento
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

      for (let i = 0; i < nfe.itens.length; i++) {
        const item = nfe.itens[i];
        
        // Registrar item mesmo sem ICMS (controle)
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
          
          // Marcar documento como processado
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
      message: `Ingestao concluida: ${inserted} inseridos, ${duplicates} duplicados, ${creditsCreated} creditos gerados`,
      meta: { inserted, duplicates, creditsCreated, errors },
    });

    const response = {
      success: true,
      inserted,
      duplicates,
      credits_created: creditsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Ingestao concluida:", response);

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
