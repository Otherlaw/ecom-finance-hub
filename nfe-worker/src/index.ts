/**
 * NFe Worker - Entry Point
 * Servidor Express para sincronizacao de NF-e via Distribuicao DF-e
 * 
 * Modos de operacao:
 * - Bootstrap: primeira sincronizacao, busca docs dos ultimos 90 dias
 * - Incremental: syncs seguintes, continua do ultimo NSU
 * 
 * Regras importantes:
 * - NSU SEMPRE avanca, mesmo quando docs sao ignorados por data
 * - Bootstrap para apos N lotes consecutivos com 100% docs antigos
 * - Erro SEFAZ 656 (Consumo Indevido): delay entre requests + log claro
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { SupabaseWorkerClient } from './supabase-client.js';
import { SefazClient } from './sefaz-client.js';
import { decrypt } from './crypto.js';
// Usando IngestResponse do types.ts que tem todos os campos necessarios
import type { IngestResponse } from './types.js';

// Configuracoes
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const WORKER_INGEST_TOKEN = process.env.WORKER_INGEST_TOKEN!;
const CERT_MASTER_KEY = process.env.CERT_MASTER_KEY!;

// Parametros de sincronizacao
const BATCH_SIZE = 50; // Maximo de docs por lote para ingestao
const REQUEST_DELAY_MS = 1500; // Delay entre requisicoes SEFAZ (rate limit) - aumentado para 1.5s
const SYNC_WINDOW_DAYS = 90; // Janela de 90 dias (3 meses)
const BOOTSTRAP_STOP_THRESHOLD = 3; // Lotes consecutivos com 100% docs antigos para parar

// Validar configuracoes
const missingVars: string[] = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!WORKER_INGEST_TOKEN) missingVars.push('WORKER_INGEST_TOKEN');
if (!CERT_MASTER_KEY) missingVars.push('CERT_MASTER_KEY');

if (missingVars.length > 0) {
  console.error('===========================================');
  console.error('ERRO: Variaveis de ambiente obrigatorias faltando:');
  missingVars.forEach(v => console.error(`  - ${v}`));
  console.error('===========================================');
  console.error('Configure estas variaveis no painel do Render:');
  console.error('  Dashboard -> Environment -> Add Environment Variable');
  console.error('===========================================');
  process.exit(1);
}

// Cliente Supabase (via proxy)
const supabase = new SupabaseWorkerClient(SUPABASE_URL, WORKER_INGEST_TOKEN);

// Express app
const app = express();
app.use(express.json());

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Calcula a data de corte (90 dias atras)
 */
function getCutoffDate(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SYNC_WINDOW_DAYS);
  return cutoff.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Verifica se e modo bootstrap (primeira sync)
 * Bootstrap = nao existe estado OU (ult_nsu = 0 E last_sync_at null)
 */
function isBootstrapMode(syncState: { ult_nsu: number; last_sync_at: string | null } | null): boolean {
  if (!syncState) return true;
  return syncState.ult_nsu === 0 && !syncState.last_sync_at;
}

/**
 * Verifica se erro eh 656 (Consumo Indevido)
 */
function isSefazError656(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('656') || error.message.includes('Consumo Indevido');
  }
  return false;
}

/**
 * Sincroniza uma empresa especifica
 */
async function syncEmpresa(empresaId: string): Promise<{
  success: boolean;
  documentsProcessed: number;
  documentsImported: number;
  creditsCreated: number;
  error?: string;
}> {
  console.log(`[SYNC] ========================================`);
  console.log(`[SYNC] Iniciando sincronizacao para empresa ${empresaId}`);
  console.log(`[SYNC] ========================================`);

  try {
    // Buscar certificado
    const certificate = await supabase.getCertificate(empresaId);
    if (!certificate) {
      throw new Error('Certificado nao encontrado');
    }

    // Buscar estado atual
    const syncState = await supabase.getSyncState(empresaId);
    const isBootstrap = isBootstrapMode(syncState);
    const ultNSU = syncState?.ult_nsu || 0;
    const cutoffDate = getCutoffDate();

    // Log do modo de operacao
    if (isBootstrap) {
      await supabase.log(empresaId, 'info', `Iniciando BOOTSTRAP (ultimos ${SYNC_WINDOW_DAYS} dias). Cutoff: ${cutoffDate}`);
      console.log(`[SYNC] Modo BOOTSTRAP - cutoff: ${cutoffDate}`);
    } else {
      await supabase.log(empresaId, 'info', `Iniciando sync INCREMENTAL a partir do NSU ${ultNSU}`);
      console.log(`[SYNC] Modo INCREMENTAL - NSU inicial: ${ultNSU}`);
    }

    // Atualizar estado para running
    await supabase.updateSyncState(empresaId, { status: 'running' });

    // Descriptografar certificado
    let pfxBase64 = certificate.cert_pfx_encrypted;
    let password = certificate.cert_password_encrypted;

    try {
      if (CERT_MASTER_KEY && certificate.cert_pfx_encrypted.length > 100) {
        pfxBase64 = decrypt(certificate.cert_pfx_encrypted, CERT_MASTER_KEY);
        password = decrypt(certificate.cert_password_encrypted, CERT_MASTER_KEY);
      }
    } catch {
      console.log('[SYNC] Usando certificado sem criptografia');
    }

    // Criar cliente SEFAZ
    const sefaz = new SefazClient(pfxBase64, password, certificate.ambiente, certificate.uf);

    let currentNSU = ultNSU;
    let totalDocumentsFetched = 0;
    let totalDocumentsImported = 0;
    let totalCredits = 0;
    let hasMore = true;
    let maxNSU = 0;

    // Contadores para logica de parada do bootstrap
    let consecutiveOldOnlyBatches = 0;

    // Iterar ate nao ter mais documentos
    while (hasMore) {
      await supabase.log(empresaId, 'debug', `Consultando NSU ${currentNSU} (max: ${maxNSU || '?'})`);
      console.log(`[SYNC] Consultando NSU ${currentNSU}...`);

      try {
        const result = await sefaz.consultarDistribuicao(certificate.cnpj, currentNSU);
        
        maxNSU = result.maxNSU;
        hasMore = result.hasMore;

        console.log(`[SYNC] SEFAZ retornou ${result.documents.length} docs. ultNSU: ${result.ultNSU}, maxNSU: ${maxNSU}`);

        if (result.documents.length > 0) {
          // Enviar em lotes
          for (let i = 0; i < result.documents.length; i += BATCH_SIZE) {
            const batch = result.documents.slice(i, i + BATCH_SIZE);
            
            try {
              const ingestResult: IngestResponse = await supabase.ingestDocuments({
                empresa_id: empresaId,
                documents: batch,
              });

              totalDocumentsFetched += ingestResult.total_in_batch;
              totalDocumentsImported += ingestResult.inserted;
              totalCredits += ingestResult.credits_created;

              const logMsg = `Lote: ${ingestResult.inserted} importados, ${ingestResult.skipped_old} antigos, ${ingestResult.duplicates} duplicados, ${ingestResult.credits_created} creditos`;
              console.log(`[SYNC] ${logMsg}`);
              await supabase.log(empresaId, 'info', logMsg);

              // Logica de parada do bootstrap: verificar se lote teve 100% docs antigos
              if (isBootstrap) {
                const batchSize = ingestResult.total_in_batch;
                const oldDocs = ingestResult.skipped_old;
                // Considera "antigos" tambem os duplicados e sem XML, ja que nao sao novas importacoes
                const nonImported = oldDocs + ingestResult.duplicates + (ingestResult.skipped_no_xml || 0);
                const allOld = batchSize > 0 && nonImported === batchSize;

                if (allOld) {
                  consecutiveOldOnlyBatches++;
                  console.log(`[SYNC] Lote sem novos docs (${consecutiveOldOnlyBatches}/${BOOTSTRAP_STOP_THRESHOLD})`);
                  await supabase.log(empresaId, 'info', `Lote sem novos docs (${consecutiveOldOnlyBatches}/${BOOTSTRAP_STOP_THRESHOLD})`);
                } else {
                  // Reset contador se encontrou docs novos
                  consecutiveOldOnlyBatches = 0;
                }

                // Parar bootstrap se atingiu threshold
                if (consecutiveOldOnlyBatches >= BOOTSTRAP_STOP_THRESHOLD) {
                  const stopMsg = `Bootstrap encerrado: ${BOOTSTRAP_STOP_THRESHOLD} lotes consecutivos sem docs novos`;
                  await supabase.log(empresaId, 'info', stopMsg);
                  console.log(`[SYNC] ${stopMsg}`);
                  hasMore = false;
                  break;
                }
              }

            } catch (error) {
              console.error('[SYNC] Erro no lote:', error);
              await supabase.log(empresaId, 'error', `Erro ao processar lote: ${error}`);
            }
          }
        }

        // SEMPRE avanca o NSU, mesmo quando docs sao ignorados
        // IMPORTANTE: usar o ultNSU retornado pela SEFAZ, nao o anterior
        currentNSU = result.ultNSU;

        // Atualizar estado intermediario
        await supabase.updateSyncState(empresaId, {
          ult_nsu: currentNSU,
          max_nsu: maxNSU,
          documents_fetched: totalDocumentsFetched,
          credits_created: totalCredits,
        });

        // Delay para respeitar rate limit da SEFAZ
        if (hasMore) {
          console.log(`[SYNC] Aguardando ${REQUEST_DELAY_MS}ms antes da proxima requisicao...`);
          await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
        }

      } catch (error) {
        // Tratamento especial para erro SEFAZ 656
        if (isSefazError656(error)) {
          const errorMsg = 'Erro SEFAZ 656: Consumo Indevido. Aguarde 1 hora antes de tentar novamente. NSU atual foi preservado.';
          console.error(`[SYNC] ${errorMsg}`);
          await supabase.log(empresaId, 'error', errorMsg);
          
          // Salvar estado atual sem perder progresso
          await supabase.updateSyncState(empresaId, {
            status: 'error',
            last_error: errorMsg,
            ult_nsu: currentNSU, // Preserva NSU atual
            max_nsu: maxNSU,
          });

          return {
            success: false,
            documentsProcessed: totalDocumentsFetched,
            documentsImported: totalDocumentsImported,
            creditsCreated: totalCredits,
            error: errorMsg,
          };
        }

        // Outros erros SEFAZ
        throw error;
      }
    }

    // Finalizar com sucesso
    const finishMessage = isBootstrap
      ? `Bootstrap concluido: ${totalDocumentsImported} docs importados de ${totalDocumentsFetched} buscados, ${totalCredits} creditos`
      : `Sync incremental concluido: ${totalDocumentsImported} docs importados, ${totalCredits} creditos`;

    await supabase.updateSyncState(empresaId, {
      status: 'idle',
      last_sync_at: new Date().toISOString(),
      last_error: null,
      ult_nsu: currentNSU,
      max_nsu: maxNSU,
      documents_fetched: totalDocumentsFetched,
      credits_created: totalCredits,
    });

    await supabase.log(empresaId, 'info', finishMessage);
    console.log(`[SYNC] ${finishMessage}`);

    return {
      success: true,
      documentsProcessed: totalDocumentsFetched,
      documentsImported: totalDocumentsImported,
      creditsCreated: totalCredits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SYNC] Erro fatal: ${message}`);

    await supabase.updateSyncState(empresaId, {
      status: 'error',
      last_error: message,
    });

    await supabase.log(empresaId, 'error', `Erro na sincronizacao: ${message}`);

    return {
      success: false,
      documentsProcessed: 0,
      documentsImported: 0,
      creditsCreated: 0,
      error: message,
    };
  }
}

/**
 * Endpoint para sincronizar empresa especifica
 */
app.post('/sync', async (req: Request, res: Response) => {
  const { empresa_id } = req.body;

  if (!empresa_id) {
    res.status(400).json({ error: 'empresa_id obrigatorio' });
    return;
  }

  // Executar sync em background
  syncEmpresa(empresa_id).catch(console.error);

  res.json({ message: 'Sincronizacao iniciada', empresa_id });
});

/**
 * Endpoint para sincronizar todas as empresas
 */
app.post('/sync-all', async (_req: Request, res: Response) => {
  try {
    const companies = await supabase.getActiveCompanies();
    
    console.log(`[SYNC-ALL] Iniciando sincronizacao de ${companies.length} empresas`);

    // Executar em sequencia para evitar sobrecarga
    for (const company of companies) {
      await syncEmpresa(company.empresa_id);
      // Delay entre empresas (5 segundos)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    res.json({ message: 'Sincronizacao de todas as empresas concluida', count: companies.length });
  } catch (error) {
    console.error('[SYNC-ALL] Erro:', error);
    res.status(500).json({ error: 'Erro ao sincronizar empresas' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('===========================================');
  console.log(`NFe Worker rodando na porta ${PORT}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Modo: Proxy via Edge Function (sem SERVICE_ROLE_KEY)`);
  console.log(`Janela de sincronizacao: ${SYNC_WINDOW_DAYS} dias`);
  console.log(`Delay entre requests: ${REQUEST_DELAY_MS}ms`);
  console.log(`Threshold bootstrap stop: ${BOOTSTRAP_STOP_THRESHOLD} lotes`);
  console.log('===========================================');
});
