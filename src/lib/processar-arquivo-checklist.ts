// src/lib/processar-arquivo-checklist.ts
// Processamento automático de arquivos enviados no checklist

import { supabase } from "@/integrations/supabase/client";
import { 
  parseXLSXMercadoLivre, 
  parseXLSXMercadoPago, 
  parseCSVFile,
  parseXLSXFile,
  ParseResult 
} from "@/lib/parsers/arquivoFinanceiro";

export interface ResultadoProcessamento {
  sucesso: boolean;
  transacoesImportadas: number;
  duplicatasIgnoradas: number;
  transacoesComErro: number;
  erros: string[];
  detalhes?: {
    totalLinhasArquivo: number;
    totalTransacoesGeradas: number;
    tipoArquivoDetectado: string;
  };
}

// Mapeia canal_id do checklist para canal do marketplace
function mapearCanalChecklist(canalId: string): string {
  const mapeamento: Record<string, string> = {
    mercado_livre: "mercado_livre",
    mercado_pago: "mercado_pago",
    shopee: "shopee",
    shein: "shein",
    tiktok: "tiktok_shop",
    amazon: "amazon",
    magalu: "magalu",
  };
  return mapeamento[canalId] || canalId;
}

// Detecta o tipo de relatório baseado no nome do arquivo e conteúdo
function detectarTipoRelatorio(fileName: string, canalId: string): "mercado_livre" | "mercado_pago" | "shopee" | "outro" {
  const fileNameLower = fileName.toLowerCase();
  
  // Detectar pelo nome do arquivo
  if (fileNameLower.includes("mercadopago") || fileNameLower.includes("mercado_pago") || fileNameLower.includes("mp_")) {
    return "mercado_pago";
  }
  if (fileNameLower.includes("mercadolivre") || fileNameLower.includes("mercado_livre") || fileNameLower.includes("ml_")) {
    return "mercado_livre";
  }
  if (fileNameLower.includes("shopee")) {
    return "shopee";
  }
  
  // Fallback para canal do checklist
  if (canalId === "mercado_livre") return "mercado_livre";
  if (canalId === "mercado_pago") return "mercado_pago";
  if (canalId === "shopee") return "shopee";
  
  return "outro";
}

// Baixa o arquivo do Storage e retorna como Blob
async function baixarArquivoDoStorage(fileUrl: string): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    // Se é uma URL do Supabase Storage, extrair o path
    const urlObj = new URL(fileUrl);
    const pathMatch = fileUrl.match(/product-images\/(.+)$/);
    
    if (pathMatch) {
      const filePath = pathMatch[1];
      const { data, error } = await supabase.storage
        .from("product-images")
        .download(filePath);
      
      if (error) {
        console.error("[baixarArquivoDoStorage] Erro:", error);
        return null;
      }
      
      // Extrair nome do arquivo do path
      const fileName = filePath.split("/").pop() || "arquivo.xlsx";
      
      return { blob: data, fileName };
    }
    
    // Fallback: fetch direto
    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const fileName = urlObj.pathname.split("/").pop() || "arquivo.xlsx";
    
    return { blob, fileName };
  } catch (error) {
    console.error("[baixarArquivoDoStorage] Erro ao baixar:", error);
    return null;
  }
}

// Parse do arquivo baseado no tipo
async function parseArquivo(
  blob: Blob, 
  fileName: string, 
  tipoRelatorio: string
): Promise<ParseResult | null> {
  try {
    // Criar File a partir do Blob
    const file = new File([blob], fileName, { type: blob.type });
    
    const ext = fileName.split(".").pop()?.toLowerCase();
    
    // Selecionar parser apropriado
    if (tipoRelatorio === "mercado_livre") {
      if (ext === "xlsx" || ext === "xls") {
        return await parseXLSXMercadoLivre(file);
      }
      // CSV do ML usa mesmo parser
      const rows = await parseCSVFile(file);
      if (rows.length === 0) return null;
      // Converter para formato esperado
      return { 
        transacoes: rows.map(r => ({
          origem: "marketplace",
          canal: "mercado_livre",
          data_transacao: r["data"] || r["Data"] || "",
          descricao: r["descricao"] || r["Descrição"] || "Transação ML",
          valor_liquido: parseFloat(r["valor"] || r["Valor"] || "0"),
          tipo_transacao: "outro",
          tipo_lancamento: "credito",
          referencia_externa: r["id"] || r["ID"] || "",
        })),
        estatisticas: {
          totalLinhasArquivo: rows.length,
          totalTransacoesGeradas: rows.length,
          totalComValorZero: 0,
          totalDescartadasPorFormato: 0,
          totalLinhasVazias: 0,
        }
      };
    }
    
    if (tipoRelatorio === "mercado_pago") {
      return await parseXLSXMercadoPago(file);
    }
    
    // Parser genérico para outros
    if (ext === "xlsx" || ext === "xls") {
      const rows = await parseXLSXFile(file);
      return {
        transacoes: rows.map((r: any) => ({
          origem: "marketplace",
          canal: tipoRelatorio,
          data_transacao: r["data"] || r["Data"] || r["DATE"] || "",
          descricao: r["descricao"] || r["Descrição"] || r["DESCRIPTION"] || "Transação",
          valor_liquido: parseFloat(r["valor"] || r["Valor"] || r["VALUE"] || "0") || 0,
          tipo_transacao: "outro",
          tipo_lancamento: "credito",
          referencia_externa: r["id"] || r["ID"] || "",
        })),
        estatisticas: {
          totalLinhasArquivo: rows.length,
          totalTransacoesGeradas: rows.length,
          totalComValorZero: 0,
          totalDescartadasPorFormato: 0,
          totalLinhasVazias: 0,
        }
      };
    }
    
    // CSV genérico
    const rows = await parseCSVFile(file);
    return {
      transacoes: rows,
      estatisticas: {
        totalLinhasArquivo: rows.length,
        totalTransacoesGeradas: rows.length,
        totalComValorZero: 0,
        totalDescartadasPorFormato: 0,
        totalLinhasVazias: 0,
      }
    };
  } catch (error) {
    console.error("[parseArquivo] Erro:", error);
    return null;
  }
}

// Normaliza o nome do canal para comparação consistente
function normalizarCanal(canal: string): string {
  const mapeamento: Record<string, string> = {
    "Mercado Livre": "mercado_livre",
    "MercadoLivre": "mercado_livre",
    "MERCADO_LIVRE": "mercado_livre",
    "Mercado Pago": "mercado_pago",
    "MercadoPago": "mercado_pago",
    "MERCADO_PAGO": "mercado_pago",
    "Shopee": "shopee",
    "SHOPEE": "shopee",
    "Shein": "shein",
    "SHEIN": "shein",
    "TikTok Shop": "tiktok_shop",
    "TikTok": "tiktok_shop",
    "TIKTOK": "tiktok_shop",
    "Amazon": "amazon",
    "AMAZON": "amazon",
    "Magalu": "magalu",
    "MAGALU": "magalu",
  };
  
  return mapeamento[canal] || canal.toLowerCase().replace(/\s+/g, "_");
}

// Verifica duplicatas na tabela marketplace_transactions usando múltiplos critérios
async function verificarDuplicatas(
  empresaId: string, 
  canal: string, 
  referenciaExterna: string,
  dataTransacao?: string,
  valorLiquido?: number,
  descricao?: string
): Promise<boolean> {
  // Primeiro tenta por referência externa (mais preciso)
  if (referenciaExterna && referenciaExterna.trim()) {
    const { data: byRef, error: errRef } = await supabase
      .from("marketplace_transactions")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("referencia_externa", referenciaExterna.trim())
      .limit(1);
    
    if (!errRef && byRef && byRef.length > 0) {
      return true;
    }
  }
  
  // Fallback: verificar por combinação data + valor + descrição (para evitar duplas entre API e upload)
  if (dataTransacao && valorLiquido !== undefined) {
    const canalNormalizado = normalizarCanal(canal);
    
    // Também verifica com variações do canal (API pode usar nome diferente do upload)
    const { data: byCombo, error: errCombo } = await supabase
      .from("marketplace_transactions")
      .select("id, canal, descricao")
      .eq("empresa_id", empresaId)
      .eq("data_transacao", dataTransacao)
      .gte("valor_liquido", valorLiquido - 0.01)
      .lte("valor_liquido", valorLiquido + 0.01)
      .limit(10);
    
    if (!errCombo && byCombo && byCombo.length > 0) {
      // Verificar se algum match é do mesmo canal (normalizado) ou descrição similar
      for (const match of byCombo) {
        const matchCanalNorm = normalizarCanal(match.canal || "");
        if (matchCanalNorm === canalNormalizado) {
          return true;
        }
        // Se descrição é muito similar, considerar duplicata
        if (descricao && match.descricao) {
          const descNorm = descricao.toLowerCase().trim();
          const matchDescNorm = match.descricao.toLowerCase().trim();
          if (descNorm === matchDescNorm || descNorm.includes(matchDescNorm) || matchDescNorm.includes(descNorm)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Inserir transações no banco com verificação inteligente de duplicatas
async function inserirTransacoes(
  transacoes: any[], 
  empresaId: string, 
  canal: string
): Promise<{ inseridas: number; duplicatas: number; erros: number; mensagensErro: string[] }> {
  let inseridas = 0;
  let duplicatas = 0;
  let erros = 0;
  const mensagensErro: string[] = [];
  
  // Normalizar canal para consistência
  const canalNormalizado = normalizarCanal(canal);
  
  for (const transacao of transacoes) {
    try {
      // Gerar referência externa se não existir
      const referenciaExterna = transacao.referencia_externa || 
        `${transacao.data_transacao}_${transacao.valor_liquido}_${(transacao.descricao || "").substring(0, 30)}`;
      
      // Verificar duplicata usando múltiplos critérios (API vs Upload)
      const isDuplicata = await verificarDuplicatas(
        empresaId, 
        canalNormalizado, 
        referenciaExterna,
        transacao.data_transacao,
        transacao.valor_liquido,
        transacao.descricao
      );
      
      if (isDuplicata) {
        duplicatas++;
        continue;
      }
      
      // Preparar dados para inserção
      const dadosInsercao = {
        empresa_id: empresaId,
        canal: canalNormalizado, // Usar canal normalizado
        data_transacao: transacao.data_transacao,
        descricao: transacao.descricao || "Transação importada",
        valor_liquido: transacao.valor_liquido || 0,
        valor_bruto: transacao.valor_bruto || transacao.valor_liquido || 0,
        tipo_transacao: transacao.tipo_transacao || "outro",
        tipo_lancamento: transacao.tipo_lancamento || "credito",
        referencia_externa: referenciaExterna,
        pedido_id: transacao.pedido_id || null,
        tarifas: transacao.tarifas || 0,
        taxas: transacao.taxas || 0,
        outros_descontos: transacao.outros_descontos || 0,
        frete_vendedor: transacao.frete_vendedor || 0,
        frete_comprador: transacao.frete_comprador || 0,
        custo_ads: transacao.custo_ads || 0,
        origem_extrato: "checklist_upload",
        status: "importado",
      };
      
      const { error } = await supabase
        .from("marketplace_transactions")
        .insert(dadosInsercao);
      
      if (error) {
        // Se o erro for de duplicata (constraint violation), contar como duplicata
        if (error.code === "23505") {
          duplicatas++;
          continue;
        }
        erros++;
        if (mensagensErro.length < 5) {
          mensagensErro.push(`Linha ${inseridas + duplicatas + erros}: ${error.message}`);
        }
        continue;
      }
      
      inseridas++;
    } catch (e) {
      erros++;
      if (mensagensErro.length < 5) {
        mensagensErro.push(`Erro inesperado: ${e instanceof Error ? e.message : "Desconhecido"}`);
      }
    }
  }
  
  return { inseridas, duplicatas, erros, mensagensErro };
}

// Função principal de processamento
export async function processarArquivoChecklist(
  arquivoId: string,
  fileUrl: string,
  canalId: string,
  empresaId: string,
  nomeArquivo: string
): Promise<ResultadoProcessamento> {
  console.log(`[processarArquivoChecklist] Iniciando: ${nomeArquivo} para canal ${canalId}`);
  
  try {
    // 1. Baixar arquivo do Storage
    const downloadResult = await baixarArquivoDoStorage(fileUrl);
    
    if (!downloadResult) {
      return {
        sucesso: false,
        transacoesImportadas: 0,
        duplicatasIgnoradas: 0,
        transacoesComErro: 0,
        erros: ["Não foi possível baixar o arquivo do storage"],
      };
    }
    
    const { blob, fileName } = downloadResult;
    
    // 2. Detectar tipo de relatório
    const tipoRelatorio = detectarTipoRelatorio(fileName, canalId);
    console.log(`[processarArquivoChecklist] Tipo detectado: ${tipoRelatorio}`);
    
    // 3. Parse do arquivo
    const parseResult = await parseArquivo(blob, fileName, tipoRelatorio);
    
    if (!parseResult || parseResult.transacoes.length === 0) {
      return {
        sucesso: false,
        transacoesImportadas: 0,
        duplicatasIgnoradas: 0,
        transacoesComErro: 0,
        erros: ["Não foi possível extrair transações do arquivo ou arquivo vazio"],
      };
    }
    
    console.log(`[processarArquivoChecklist] Transações extraídas: ${parseResult.transacoes.length}`);
    
    // 4. Mapear canal
    const canalMapeado = mapearCanalChecklist(canalId);
    
    // 5. Inserir transações
    const resultadoInsercao = await inserirTransacoes(
      parseResult.transacoes, 
      empresaId, 
      canalMapeado
    );
    
    console.log(`[processarArquivoChecklist] Resultado:`, resultadoInsercao);
    
    // 6. Atualizar registro do arquivo
    const { error: updateError } = await supabase
      .from("checklist_canal_arquivos")
      .update({
        processado: true,
        resultado_processamento: {
          tipo_arquivo: tipoRelatorio,
          estatisticas: parseResult.estatisticas,
          resultado: resultadoInsercao,
          processado_em: new Date().toISOString(),
        },
        transacoes_importadas: resultadoInsercao.inseridas,
      })
      .eq("id", arquivoId);
    
    if (updateError) {
      console.error("[processarArquivoChecklist] Erro ao atualizar arquivo:", updateError);
    }
    
    return {
      sucesso: resultadoInsercao.inseridas > 0 || resultadoInsercao.duplicatas > 0,
      transacoesImportadas: resultadoInsercao.inseridas,
      duplicatasIgnoradas: resultadoInsercao.duplicatas,
      transacoesComErro: resultadoInsercao.erros,
      erros: resultadoInsercao.mensagensErro,
      detalhes: {
        totalLinhasArquivo: parseResult.estatisticas.totalLinhasArquivo,
        totalTransacoesGeradas: parseResult.estatisticas.totalTransacoesGeradas,
        tipoArquivoDetectado: tipoRelatorio,
      },
    };
  } catch (error) {
    console.error("[processarArquivoChecklist] Erro geral:", error);
    return {
      sucesso: false,
      transacoesImportadas: 0,
      duplicatasIgnoradas: 0,
      transacoesComErro: 0,
      erros: [error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo"],
    };
  }
}
