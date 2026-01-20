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
import {
  atualizarFaseJob,
  atualizarProgressoJob,
  finalizarJobChecklist,
  verificarJobCancelado,
} from "@/hooks/useChecklistImportJobs";

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

// Callback para atualização de progresso
export interface ProgressCallback {
  jobId: string;
  onProgress?: (processed: number, total: number) => void;
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

// Verifica duplicatas em BATCH para melhor performance
// Retorna Set com referências que já existem no banco
async function verificarDuplicatasBatch(
  empresaId: string, 
  canal: string, 
  transacoes: Array<{
    referencia_externa?: string;
    data_transacao?: string;
    valor_liquido?: number;
  }>
): Promise<Set<string>> {
  const duplicatasEncontradas = new Set<string>();
  const canalNormalizado = normalizarCanal(canal);
  
  // Coletar todas as referências externas válidas
  const referenciasValidas = transacoes
    .filter(t => t.referencia_externa?.trim())
    .map(t => t.referencia_externa!.trim());
  
  // Buscar duplicatas por referência externa em lotes de 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < referenciasValidas.length; i += BATCH_SIZE) {
    const batch = referenciasValidas.slice(i, i + BATCH_SIZE);
    
    const { data: existentes } = await supabase
      .from("marketplace_transactions")
      .select("referencia_externa")
      .eq("empresa_id", empresaId)
      .in("referencia_externa", batch);
    
    if (existentes) {
      existentes.forEach(e => {
        if (e.referencia_externa) duplicatasEncontradas.add(e.referencia_externa);
      });
    }
  }
  
  // Buscar por combinação data+valor (para duplicatas entre API e upload)
  // Agrupa transações únicas por data para buscar uma vez
  const porData = new Map<string, Array<{ valor: number; ref: string }>>();
  
  for (const t of transacoes) {
    if (t.data_transacao && t.valor_liquido !== undefined) {
      const ref = t.referencia_externa || 
        `${t.data_transacao}_${t.valor_liquido}`;
      
      // Só verificar se ainda não foi marcado como duplicata por referência
      if (!duplicatasEncontradas.has(ref)) {
        if (!porData.has(t.data_transacao)) {
          porData.set(t.data_transacao, []);
        }
        porData.get(t.data_transacao)!.push({ 
          valor: t.valor_liquido, 
          ref 
        });
      }
    }
  }
  
  // Verificar duplicatas por data+valor (pegar datas únicas)
  const datasUnicas = Array.from(porData.keys()).slice(0, 50); // Limitar a 50 datas
  
  for (const data of datasUnicas) {
    const transacoesNaData = porData.get(data)!;
    const valoresMinMax = transacoesNaData.map(t => t.valor);
    const minValor = Math.min(...valoresMinMax) - 0.01;
    const maxValor = Math.max(...valoresMinMax) + 0.01;
    
    const { data: existentesPorData } = await supabase
      .from("marketplace_transactions")
      .select("id, valor_liquido, canal")
      .eq("empresa_id", empresaId)
      .eq("data_transacao", data)
      .gte("valor_liquido", minValor)
      .lte("valor_liquido", maxValor)
      .limit(100);
    
    if (existentesPorData) {
      for (const existente of existentesPorData) {
        const canalExistente = normalizarCanal(existente.canal || "");
        if (canalExistente === canalNormalizado) {
          // Marcar transações com esse valor como duplicatas
          for (const t of transacoesNaData) {
            if (Math.abs(t.valor - existente.valor_liquido) <= 0.01) {
              duplicatasEncontradas.add(t.ref);
            }
          }
        }
      }
    }
  }
  
  return duplicatasEncontradas;
}

// Inserir transações no banco com inserção em LOTES para melhor performance
// Usa verificação de duplicatas em batch antes de inserir
async function inserirTransacoes(
  transacoes: any[], 
  empresaId: string, 
  canal: string,
  jobId?: string
): Promise<{ inseridas: number; duplicatas: number; erros: number; mensagensErro: string[] }> {
  let inseridas = 0;
  let duplicatas = 0;
  let erros = 0;
  const mensagensErro: string[] = [];
  
  // Normalizar canal para consistência
  const canalNormalizado = normalizarCanal(canal);
  
  // ETAPA 1: Verificar duplicatas em batch (muito mais rápido)
  if (jobId) await atualizarFaseJob(jobId, "verificando_duplicatas");
  
  // Preparar transações com referências
  const transacoesComRef = transacoes.map(t => ({
    ...t,
    referencia_externa: t.referencia_externa || 
      `${t.data_transacao}_${t.valor_liquido}_${(t.descricao || "").substring(0, 30)}`,
  }));
  
  // Verificar todas as duplicatas de uma vez
  const duplicatasSet = await verificarDuplicatasBatch(
    empresaId,
    canalNormalizado,
    transacoesComRef.map(t => ({
      referencia_externa: t.referencia_externa,
      data_transacao: t.data_transacao,
      valor_liquido: t.valor_liquido,
    }))
  );
  
  // Filtrar transações que não são duplicatas
  const transacoesNovas = transacoesComRef.filter(t => !duplicatasSet.has(t.referencia_externa));
  duplicatas = transacoesComRef.length - transacoesNovas.length;
  
  console.log(`[inserirTransacoes] Total: ${transacoes.length}, Duplicatas: ${duplicatas}, Novas: ${transacoesNovas.length}`);
  
  // Atualizar progresso após verificação
  if (jobId) {
    await atualizarProgressoJob(jobId, {
      linhas_processadas: duplicatas,
      linhas_duplicadas: duplicatas,
    });
    await atualizarFaseJob(jobId, "inserindo");
  }
  
  // ETAPA 2: Inserir em lotes (batch insert)
  const BATCH_SIZE = 100; // Inserir 100 por vez
  const UPDATE_INTERVAL = 50; // Atualizar progresso a cada 50 inserções
  
  for (let i = 0; i < transacoesNovas.length; i += BATCH_SIZE) {
    // Verificar se job foi cancelado
    if (jobId && i % (BATCH_SIZE * 2) === 0) {
      const cancelado = await verificarJobCancelado(jobId);
      if (cancelado) {
        console.log(`[inserirTransacoes] Job ${jobId} cancelado pelo usuário`);
        break;
      }
    }
    
    const batch = transacoesNovas.slice(i, i + BATCH_SIZE);
    
    // Preparar dados para inserção em lote
    const dadosBatch = batch.map(transacao => ({
      empresa_id: empresaId,
      canal: canalNormalizado,
      data_transacao: transacao.data_transacao,
      descricao: transacao.descricao || "Transação importada",
      valor_liquido: transacao.valor_liquido || 0,
      valor_bruto: transacao.valor_bruto || transacao.valor_liquido || 0,
      tipo_transacao: transacao.tipo_transacao || "outro",
      tipo_lancamento: transacao.tipo_lancamento || "credito",
      referencia_externa: transacao.referencia_externa,
      pedido_id: transacao.pedido_id || null,
      tarifas: transacao.tarifas || 0,
      taxas: transacao.taxas || 0,
      outros_descontos: transacao.outros_descontos || 0,
      frete_vendedor: transacao.frete_vendedor || 0,
      frete_comprador: transacao.frete_comprador || 0,
      custo_ads: transacao.custo_ads || 0,
      origem_extrato: "checklist_upload",
      status: "importado",
    }));
    
    try {
      const { error, data } = await supabase
        .from("marketplace_transactions")
        .insert(dadosBatch)
        .select("id");
      
      if (error) {
        // Se houver erro de constraint em lote, tentar inserir um por um
        if (error.code === "23505") {
          // Inserção individual para contabilizar corretamente
          for (const dado of dadosBatch) {
            try {
              const { error: errIndiv } = await supabase
                .from("marketplace_transactions")
                .insert(dado);
              
              if (errIndiv) {
                if (errIndiv.code === "23505") {
                  duplicatas++;
                } else {
                  erros++;
                  if (mensagensErro.length < 5) {
                    mensagensErro.push(`Erro: ${errIndiv.message}`);
                  }
                }
              } else {
                inseridas++;
              }
            } catch (e) {
              erros++;
            }
          }
        } else {
          erros += batch.length;
          if (mensagensErro.length < 5) {
            mensagensErro.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          }
        }
      } else {
        inseridas += data?.length || batch.length;
      }
    } catch (e) {
      erros += batch.length;
      if (mensagensErro.length < 5) {
        mensagensErro.push(`Erro inesperado no lote: ${e instanceof Error ? e.message : "Desconhecido"}`);
      }
    }
    
    // Atualizar progresso periodicamente
    if (jobId && (i % UPDATE_INTERVAL === 0 || i + BATCH_SIZE >= transacoesNovas.length)) {
      const processadas = duplicatas + inseridas + erros;
      await atualizarProgressoJob(jobId, {
        linhas_processadas: processadas,
        linhas_importadas: inseridas,
        linhas_duplicadas: duplicatas,
        linhas_com_erro: erros,
      });
    }
  }
  
  // Atualização final de progresso
  if (jobId) {
    await atualizarProgressoJob(jobId, {
      linhas_processadas: duplicatas + inseridas + erros,
      linhas_importadas: inseridas,
      linhas_duplicadas: duplicatas,
      linhas_com_erro: erros,
    });
  }
  
  return { inseridas, duplicatas, erros, mensagensErro };
}

// Função principal de processamento (síncrona, para compatibilidade)
export async function processarArquivoChecklist(
  arquivoId: string,
  fileUrl: string,
  canalId: string,
  empresaId: string,
  nomeArquivo: string,
  jobId?: string
): Promise<ResultadoProcessamento> {
  console.log(`[processarArquivoChecklist] Iniciando: ${nomeArquivo} para canal ${canalId}${jobId ? ` (job: ${jobId})` : ""}`);
  
  try {
    // 1. Baixar arquivo do Storage
    if (jobId) await atualizarFaseJob(jobId, "baixando");
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
    
    // 2. Detectar tipo de relatório e fazer parse
    if (jobId) await atualizarFaseJob(jobId, "parsing");
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
    
    // Atualizar total de linhas no job
    if (jobId) {
      await atualizarProgressoJob(jobId, { total_linhas: parseResult.transacoes.length });
      await atualizarFaseJob(jobId, "verificando_duplicatas");
    }
    
    // 4. Mapear canal
    const canalMapeado = mapearCanalChecklist(canalId);
    
    // 5. Inserir transações (com progresso se tiver jobId)
    if (jobId) await atualizarFaseJob(jobId, "inserindo");
    const resultadoInsercao = await inserirTransacoes(
      parseResult.transacoes, 
      empresaId, 
      canalMapeado,
      jobId
    );
    
    console.log(`[processarArquivoChecklist] Resultado:`, resultadoInsercao);
    
    // 6. Atualizar registro do arquivo
    const resultadoParaArquivo = {
      tipo_arquivo: tipoRelatorio,
      estatisticas: parseResult.estatisticas,
      resultado: resultadoInsercao,
      processado_em: new Date().toISOString(),
    };
    
    const { error: updateError } = await supabase
      .from("checklist_canal_arquivos")
      .update({
        processado: true,
        resultado_processamento: resultadoParaArquivo,
        transacoes_importadas: resultadoInsercao.inseridas,
      })
      .eq("id", arquivoId);
    
    if (updateError) {
      console.error("[processarArquivoChecklist] Erro ao atualizar arquivo:", updateError);
    }
    
    // 7. Finalizar job se existir
    if (jobId) {
      await finalizarJobChecklist(jobId, {
        sucesso: resultadoInsercao.inseridas > 0 || resultadoInsercao.duplicatas > 0,
        linhasImportadas: resultadoInsercao.inseridas,
        linhasDuplicadas: resultadoInsercao.duplicatas,
        linhasComErro: resultadoInsercao.erros,
        resultadoProcessamento: resultadoParaArquivo,
      });
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
    
    // Finalizar job com erro
    if (jobId) {
      await finalizarJobChecklist(jobId, {
        sucesso: false,
        linhasImportadas: 0,
        linhasDuplicadas: 0,
        linhasComErro: 0,
        mensagemErro: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
    
    return {
      sucesso: false,
      transacoesImportadas: 0,
      duplicatasIgnoradas: 0,
      transacoesComErro: 0,
      erros: [error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo"],
    };
  }
}

/**
 * Versão em background do processamento de arquivo
 * Cria job, inicia processamento e retorna imediatamente
 */
export async function processarArquivoChecklistBackground(
  arquivoId: string,
  fileUrl: string,
  canalId: string,
  empresaId: string,
  nomeArquivo: string,
  checklistItemId: string
): Promise<{ jobId: string }> {
  // Criar job no banco
  const { data: job, error } = await supabase
    .from("checklist_import_jobs")
    .insert({
      empresa_id: empresaId,
      checklist_item_id: checklistItemId,
      arquivo_id: arquivoId,
      arquivo_nome: nomeArquivo,
      canal: canalId,
      status: "processando",
      fase: "iniciando",
    })
    .select("id")
    .single();

  if (error || !job) {
    throw new Error(`Erro ao criar job de importação: ${error?.message}`);
  }

  const jobId = job.id;

  // Iniciar processamento em background (não bloqueia)
  // Usa Promise sem await para não bloquear
  processarArquivoChecklist(
    arquivoId,
    fileUrl,
    canalId,
    empresaId,
    nomeArquivo,
    jobId
  ).catch((err) => {
    console.error(`[processarArquivoChecklistBackground] Erro no job ${jobId}:`, err);
    // Tentar marcar job como erro se falhar
    finalizarJobChecklist(jobId, {
      sucesso: false,
      linhasImportadas: 0,
      linhasDuplicadas: 0,
      linhasComErro: 0,
      mensagemErro: err instanceof Error ? err.message : "Erro desconhecido",
    }).catch(console.error);
  });

  return { jobId };
}
