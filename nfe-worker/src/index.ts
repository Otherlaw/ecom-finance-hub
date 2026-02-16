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
 * - Erro SEFAZ 656 (Consumo Indevido): para imediatamente, seta status rate_limited
 * 
 * Anti-Rate-Limit:
 * - MAX_SEFAZ_REQUESTS_PER_RUN: limita requests por execução para evitar 656
 * - MAX_RUNTIME_MS: tempo máximo de execução
 * - Delay com jitter randômico entre requests
 * - Backoff exponencial para erros 656 consecutivos
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { SupabaseWorkerClient } from './supabase-client.js';
import { SefazClient } from './sefaz-client.js';
import { decrypt } from './crypto.js';
import type { IngestResponse } from './types.js';
import { computeSyncWindow, getSyncMode, shouldRunNow, getNextMidnightBRT } from './sync-utils.js';

// Configuracoes
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const WORKER_INGEST_TOKEN = process.env.WORKER_INGEST_TOKEN!;
const CERT_MASTER_KEY = process.env.CERT_MASTER_KEY!;

// Parametros de sincronizacao
const BATCH_SIZE = 50; // Maximo de docs por lote para ingestao
const REQUEST_DELAY_MS = 12000; // Delay base entre requisicoes SEFAZ (12s conservador)
const REQUEST_DELAY_JITTER = 0.25; // Jitter de ±25% para evitar padrões previsíveis
const BOOTSTRAP_STOP_THRESHOLD = 3; // Lotes consecutivos com 100% docs antigos para parar

// DRY_RUN mode: log what would be imported without persisting
const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
 
// ========================================
// ANTI-RATE-LIMIT: Limites por execução
// ========================================
const MAX_SEFAZ_REQUESTS_PER_RUN = 10; // Máximo de requests à SEFAZ por execução
const MAX_RUNTIME_MS = 4 * 60 * 1000; // 4 minutos máximo por execução
const MIN_TIME_BETWEEN_RUNS_MS = 3 * 60 * 1000; // 3 minutos mínimo entre execuções

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
 * Middleware de autenticação para endpoints de sync
 */
 function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
   const syncToken = req.headers['x-worker-sync-token'];
   const expectedToken = WORKER_INGEST_TOKEN;
   
   if (!syncToken || syncToken !== expectedToken) {
     console.warn('[AUTH] Token invalido ou ausente');
     res.status(401).json({ error: 'Unauthorized: x-worker-sync-token invalido' });
     return;
   }
   
   next();
 }
 
 /**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
 * Calcula delay com jitter randômico
 */
 function getDelayWithJitter(): number {
   // Jitter de ±25%
   const jitterFactor = 1 + (Math.random() * 2 - 1) * REQUEST_DELAY_JITTER;
   return Math.round(REQUEST_DELAY_MS * jitterFactor);
 }
 
 /**
 * Verifica se última requisição SEFAZ foi muito recente
 */
 function isLastSefazRequestTooRecent(lastSefazRequestAt: string | null): boolean {
   if (!lastSefazRequestAt) return false;
   const lastRequest = new Date(lastSefazRequestAt);
   const now = new Date();
   const diffMs = now.getTime() - lastRequest.getTime();
   return diffMs < MIN_TIME_BETWEEN_RUNS_MS;
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
  rateLimited?: boolean;
   paused?: boolean;
   pauseReason?: string;
}> {
  // ★ LOG INICIAL - ANTES de qualquer try/catch para garantir visibilidade
  console.log(`[SYNC] ========================================`);
  console.log(`[SYNC] Iniciando syncEmpresa para empresa ${empresaId}`);
  console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log(`[SYNC] ========================================`);

  // Tentar registrar log no Supabase imediatamente
  try {
    await supabase.log(empresaId, 'info', 'Worker iniciou processamento da sincronizacao');
  } catch (logError) {
    console.error('[SYNC] Erro ao registrar log inicial no Supabase:', logError);
  }

  // ========================================
  // VARIÁVEIS DE ESTADO PARA FINALLY
  // ========================================
  let lockAcquired = false;
  let currentNSU = 0;
  let maxNSU = 0;
  let totalDocumentsFetched = 0;
  let totalDocumentsImported = 0;
  let totalCredits = 0;
   let sefazRequestCount = 0;
   const runStartTime = Date.now();

  try {
    // Buscar certificado
    console.log('[SYNC] Buscando certificado...');
    const certificate = await supabase.getCertificate(empresaId);
    if (!certificate) {
      throw new Error('Certificado nao encontrado');
    }
    console.log('[SYNC] Certificado encontrado com sucesso');

    // Buscar estado atual
    console.log('[SYNC] Buscando estado de sincronizacao...');
    const syncState = await supabase.getSyncState(empresaId);
    console.log(`[SYNC] Estado atual: status=${syncState?.status}, ult_nsu=${syncState?.ult_nsu}, next_retry_at=${syncState?.next_retry_at}`);
    
    // ========================================
    // BLOQUEIO REAL ANTES DE CHAMAR SEFAZ
     // Ordem: (1) next_retry_at (2) last_sefaz_request_at (3) running lock (4) setar running
    // ========================================
    if (syncState) {
      // PRIMEIRO: Verificar se next_retry_at existe e ainda esta no cooldown
      if (syncState.next_retry_at) {
        const nextRetry = new Date(syncState.next_retry_at);
        const now = new Date();
        
        if (now < nextRetry) {
           const msg = `Bloqueio de rate limit ativo. Próximo retry: ${syncState.next_retry_at}`;
          console.log(`[SYNC] BLOQUEADO: ${msg}`);
          await supabase.log(empresaId, 'warn', `Bloqueio ativo: ${msg}`);
          return {
            success: false,
            documentsProcessed: 0,
            documentsImported: 0,
            creditsCreated: 0,
            error: msg,
            rateLimited: true,
          };
        }
        // Se ja passou do tempo, limpar e continuar
        await supabase.log(empresaId, 'info', 'Periodo de rate limit expirou, retomando sincronizacao');
      }

       // SEGUNDO: Verificar se última requisição SEFAZ foi muito recente
       if (isLastSefazRequestTooRecent(syncState.last_sefaz_request_at || null)) {
         const msg = `Última requisição SEFAZ foi há menos de ${MIN_TIME_BETWEEN_RUNS_MS / 60000} minutos. Aguarde.`;
         console.log(`[SYNC] BLOQUEADO: ${msg}`);
         await supabase.log(empresaId, 'debug', msg);
         return {
           success: false,
           documentsProcessed: 0,
           documentsImported: 0,
           creditsCreated: 0,
           error: msg,
           paused: true,
           pauseReason: 'throttle',
         };
       }
 
       // TERCEIRO: Verificar se running e updated_at < 30 min (lock de concorrencia)
      if (syncState.status === 'running') {
        const updatedAt = new Date(syncState.updated_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - updatedAt.getTime()) / 60000;
        
        if (diffMinutes < 30) {
          const msg = `Sincronizacao ja em andamento (iniciada ha ${Math.round(diffMinutes)} minutos)`;
          console.log(`[SYNC] BLOQUEADO: ${msg}`);
          await supabase.log(empresaId, 'warn', msg);
          return {
            success: false,
            documentsProcessed: 0,
            documentsImported: 0,
            creditsCreated: 0,
            error: msg,
          };
        }
        // Se passou de 30 min, consideramos timeout e continuamos
        await supabase.log(empresaId, 'warn', 'Sync anterior expirou (timeout 30min), reiniciando');
      }

      // Inicializar NSU do estado anterior
      currentNSU = syncState.ult_nsu || 0;
      maxNSU = syncState.max_nsu || 0;
    }
    
    const syncMode = getSyncMode(syncState);
    const isBootstrap = syncMode === 'bootstrap';
    const syncWindow = computeSyncWindow(syncMode);
    const cutoffDate = syncWindow.cutoffDate;

    // Log do modo de operacao
    await supabase.log(empresaId, 'info', `Iniciando ${syncWindow.modeLabel}. Cutoff: ${cutoffDate}${DRY_RUN ? ' [DRY_RUN]' : ''}`);
    console.log(`[SYNC] Modo ${syncWindow.modeLabel} - cutoff: ${cutoffDate}${DRY_RUN ? ' [DRY_RUN]' : ''}, NSU: ${currentNSU}`);

     // Log dos limites de proteção
     console.log(`[SYNC] Limites: max ${MAX_SEFAZ_REQUESTS_PER_RUN} requests, max ${MAX_RUNTIME_MS / 1000}s runtime`);
     await supabase.log(empresaId, 'debug', `Limites: max ${MAX_SEFAZ_REQUESTS_PER_RUN} requests, max ${MAX_RUNTIME_MS / 1000}s runtime`);
 
     // QUARTO: Setar status = running (apos passar pelas verificacoes)
    await supabase.updateSyncState(empresaId, { 
      status: 'running',
      next_retry_at: null,
      last_error: null,
    });
    lockAcquired = true; // ★ MARCAR QUE ADQUIRIMOS O LOCK
    console.log('[SYNC] Lock adquirido (status=running)');

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

    let hasMore = true;

    // Contadores para logica de parada do bootstrap
    let consecutiveOldOnlyBatches = 0;
     
     // Motivo da pausa (se houver)
     let pauseReason: string | null = null;

    // Iterar ate nao ter mais documentos
    while (hasMore) {
       // ========================================
       // VERIFICAR LIMITES DE PROTEÇÃO
       // ========================================
       const elapsedMs = Date.now() - runStartTime;
       
       // Limite de tempo
       if (elapsedMs >= MAX_RUNTIME_MS) {
         pauseReason = `Tempo máximo de execução atingido (${Math.round(elapsedMs / 1000)}s). Continuará na próxima execução.`;
         console.log(`[SYNC] ★ PAUSA: ${pauseReason}`);
         await supabase.log(empresaId, 'info', pauseReason, {
           elapsed_ms: elapsedMs,
           sefaz_requests: sefazRequestCount,
           ult_nsu: currentNSU,
           max_nsu: maxNSU,
         });
         hasMore = false;
         break;
       }
       
       // Limite de requests
       if (sefazRequestCount >= MAX_SEFAZ_REQUESTS_PER_RUN) {
         pauseReason = `Limite de ${MAX_SEFAZ_REQUESTS_PER_RUN} requisições SEFAZ atingido. Continuará na próxima execução.`;
         console.log(`[SYNC] ★ PAUSA: ${pauseReason}`);
         await supabase.log(empresaId, 'info', pauseReason, {
           elapsed_ms: elapsedMs,
           sefaz_requests: sefazRequestCount,
           ult_nsu: currentNSU,
           max_nsu: maxNSU,
         });
         hasMore = false;
         break;
       }
 
      await supabase.log(empresaId, 'debug', `Consultando NSU ${currentNSU} (max: ${maxNSU || '?'})`);
       console.log(`[SYNC] [${sefazRequestCount + 1}/${MAX_SEFAZ_REQUESTS_PER_RUN}] Consultando NSU ${currentNSU}...`);

      try {
         // Registrar timestamp da requisição ANTES de fazer a chamada
         await supabase.updateSyncState(empresaId, {
           last_sefaz_request_at: new Date().toISOString(),
         });
         
        const result = await sefaz.consultarDistribuicao(certificate.cnpj, currentNSU);
         sefazRequestCount++;
        
        // ========================================
        // ★ PERSISTIR NSU CEDO - antes de qualquer processamento
        // ========================================
        currentNSU = result.ultNSU;
        maxNSU = result.maxNSU;
        hasMore = result.hasMore;

        console.log(`[SYNC] SEFAZ retornou ${result.documents.length} docs. ultNSU: ${currentNSU}, maxNSU: ${maxNSU}`);

        // Salvar NSU imediatamente ANTES do ingest
        await supabase.updateSyncState(empresaId, {
          ult_nsu: currentNSU,
          max_nsu: maxNSU,
        });
        console.log(`[SYNC] ★ NSU ${currentNSU} persistido (antes do ingest)`);

         // ========================================
         // CSTAT 137: SEFAZ sem mais documentos (resposta vazia final)
         // ========================================
         if (result.documents.length === 0 && !hasMore) {
            const nextRetryAt = getNextMidnightBRT();
            const cooldownMessage = `SEFAZ cStat 137: Consulta sem documentos novos. Próxima execução: 00:00 BRT.`;
           
           console.log(`[SYNC] ★ ${cooldownMessage}`);
           await supabase.log(empresaId, 'info', cooldownMessage, {
             cStat: 137,
             ult_nsu: currentNSU,
             max_nsu: maxNSU,
             next_retry_at: nextRetryAt,
             sefaz_requests_this_run: sefazRequestCount,
           });
           
           // Finalizar com cooldown para evitar consultas desnecessárias
           await supabase.updateSyncState(empresaId, {
             status: 'idle',
             last_sync_at: new Date().toISOString(),
             last_error: null,
             next_retry_at: nextRetryAt,
             ult_nsu: currentNSU,
             max_nsu: maxNSU,
             documents_fetched: totalDocumentsFetched,
             credits_created: totalCredits,
             rate_limit_count: 0,
           });
           
           lockAcquired = false;
           console.log('[SYNC] Lock liberado (status=idle, cStat 137 cooldown)');
           
           return {
             success: true,
             documentsProcessed: totalDocumentsFetched,
             documentsImported: totalDocumentsImported,
             creditsCreated: totalCredits,
             paused: true,
             pauseReason: cooldownMessage,
           };
         }
 
        if (result.documents.length > 0) {
          // Enviar em lotes
          for (let i = 0; i < result.documents.length; i += BATCH_SIZE) {
            const batch = result.documents.slice(i, i + BATCH_SIZE);
            
            try {
              const ingestResult: IngestResponse = await supabase.ingestDocuments({
                empresa_id: empresaId,
                documents: batch,
                cutoff_date: cutoffDate,
                dry_run: DRY_RUN,
              });

              totalDocumentsFetched += ingestResult.total_in_batch;
              totalDocumentsImported += ingestResult.inserted;
              totalCredits += ingestResult.credits_created;

              const logMsg = `Lote: ${ingestResult.inserted} importados, ${ingestResult.skipped_old} antigos, ${ingestResult.duplicates} duplicados, ${ingestResult.credits_created} creditos`;
              console.log(`[SYNC] ${logMsg}`);
              await supabase.log(empresaId, 'info', logMsg);

              // Logica de parada do bootstrap
              if (isBootstrap) {
                const batchSize = ingestResult.total_in_batch;
                const nonImported = ingestResult.skipped_old + ingestResult.duplicates + (ingestResult.skipped_no_xml || 0);
                const allOld = batchSize > 0 && nonImported === batchSize;

                if (allOld) {
                  consecutiveOldOnlyBatches++;
                  console.log(`[SYNC] Lote sem novos docs (${consecutiveOldOnlyBatches}/${BOOTSTRAP_STOP_THRESHOLD})`);
                  await supabase.log(empresaId, 'info', `Lote sem novos docs (${consecutiveOldOnlyBatches}/${BOOTSTRAP_STOP_THRESHOLD})`);
                } else {
                  consecutiveOldOnlyBatches = 0;
                }

                if (consecutiveOldOnlyBatches >= BOOTSTRAP_STOP_THRESHOLD) {
                  const stopMsg = `Bootstrap encerrado: ${BOOTSTRAP_STOP_THRESHOLD} lotes consecutivos sem docs novos`;
                  await supabase.log(empresaId, 'info', stopMsg);
                  console.log(`[SYNC] ${stopMsg}`);
                  hasMore = false;
                  break;
                }
              }

            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              console.error('[SYNC] Erro no lote de ingestao:', errMsg);
              await supabase.log(empresaId, 'error', `Erro no ingest: ${errMsg}`);
            }
          }
        }

        // Atualizar estado com contadores
        await supabase.updateSyncState(empresaId, {
          documents_fetched: totalDocumentsFetched,
          credits_created: totalCredits,
        });

         // Delay com jitter para respeitar rate limit da SEFAZ
        if (hasMore) {
           const delay = getDelayWithJitter();
           console.log(`[SYNC] Aguardando ${delay}ms antes da proxima requisicao (base: ${REQUEST_DELAY_MS}ms ±${REQUEST_DELAY_JITTER * 100}%)...`);
           await new Promise((resolve) => setTimeout(resolve, delay));
        }

      } catch (error) {
        // ========================================
        // TRATAMENTO ESPECIAL PARA ERRO SEFAZ 656 (Consumo Indevido)
        // Não faz retry no mesmo dia — agenda para próxima 00:00 BRT
        // ========================================
        if (isSefazError656(error)) {
           const currentRateLimitCount = (syncState?.rate_limit_count || 0) + 1;
           const nextRetryAt = getNextMidnightBRT();
           const errorMsg = `Erro SEFAZ 656: Consumo Indevido. Próxima tentativa: 00:00 BRT (tentativa #${currentRateLimitCount}).`;
          
          console.error(`[SYNC] ★ ERRO 656 DETECTADO`);
          console.error(`[SYNC] ${errorMsg}`);
          
          await supabase.log(empresaId, 'error', errorMsg, {
            cStat: 656,
            ult_nsu: currentNSU,
            max_nsu: maxNSU,
            next_retry_at: nextRetryAt,
             rate_limit_count: currentRateLimitCount,
             sefaz_requests_this_run: sefazRequestCount,
          });
          
          await supabase.updateSyncState(empresaId, {
            status: 'rate_limited',
            last_error: errorMsg,
            ult_nsu: currentNSU,
            max_nsu: maxNSU,
            next_retry_at: nextRetryAt,
             rate_limit_count: currentRateLimitCount,
             last_rate_limit_at: new Date().toISOString(),
          });

          lockAcquired = false;
          console.log('[SYNC] Lock liberado (status=rate_limited, próximo retry 00:00 BRT)');

          return {
            success: false,
            documentsProcessed: totalDocumentsFetched,
            documentsImported: totalDocumentsImported,
            creditsCreated: totalCredits,
            error: errorMsg,
            rateLimited: true,
          };
        }

        // Outros erros SEFAZ
        throw error;
      }
    }

     // ========================================
     // FINALIZAR: sucesso ou pausa
     // ========================================
     const elapsedMs = Date.now() - runStartTime;
     const hasBacklog = currentNSU < maxNSU;

     if (pauseReason) {
       // PAUSA GRACEFUL: ainda há trabalho pendente
       const pauseMessage = `Pausado: ${pauseReason} (${sefazRequestCount} requests em ${Math.round(elapsedMs / 1000)}s). Backlog: ${hasBacklog ? 'sim' : 'não'}`;
       
       await supabase.updateSyncState(empresaId, {
         status: 'idle', // idle permite que cron retome
         last_error: pauseReason,
         next_retry_at: null, // sem bloqueio de rate limit
         ult_nsu: currentNSU,
         max_nsu: maxNSU,
         documents_fetched: totalDocumentsFetched,
         credits_created: totalCredits,
         // rate_limit_count resetado pois não foi erro 656
         rate_limit_count: 0,
       });
 
       lockAcquired = false;
       console.log('[SYNC] Lock liberado (status=idle, pausado)');
 
       await supabase.log(empresaId, 'info', pauseMessage);
       console.log(`[SYNC] ${pauseMessage}`);
 
       return {
         success: true, // Sucesso parcial
         documentsProcessed: totalDocumentsFetched,
         documentsImported: totalDocumentsImported,
         creditsCreated: totalCredits,
         paused: true,
         pauseReason,
       };
     }
 
     // SUCESSO COMPLETO
     const finishMessage = isBootstrap
       ? `Bootstrap concluído: ${totalDocumentsImported} docs importados de ${totalDocumentsFetched} buscados, ${totalCredits} créditos (${sefazRequestCount} requests em ${Math.round(elapsedMs / 1000)}s)`
       : `Sync diário concluído: ${totalDocumentsImported} docs importados, ${totalCredits} créditos (${sefazRequestCount} requests em ${Math.round(elapsedMs / 1000)}s)`;
 
     // Se bootstrap concluiu com sucesso (sem pausa), marcar como completo
     const bootstrapUpdate = isBootstrap && !pauseReason ? {
       bootstrap_completed_at: new Date().toISOString(),
       sync_mode: 'daily',
     } : {};

     await supabase.updateSyncState(empresaId, {
       status: 'idle',
       last_sync_at: new Date().toISOString(),
       last_error: null,
       next_retry_at: null,
       ult_nsu: currentNSU,
       max_nsu: maxNSU,
       documents_fetched: totalDocumentsFetched,
       credits_created: totalCredits,
       rate_limit_count: 0,
       ...bootstrapUpdate,
     });

    lockAcquired = false; // Lock liberado com sucesso
    console.log('[SYNC] Lock liberado (status=idle, sucesso)');

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

    // ★ SEMPRE liberar lock em caso de erro
    try {
      await supabase.updateSyncState(empresaId, {
        status: 'error',
        last_error: message,
      });
      lockAcquired = false;
      console.log('[SYNC] Lock liberado (status=error)');
    } catch (updateError) {
      console.error('[SYNC] Falha ao liberar lock:', updateError);
    }

    await supabase.log(empresaId, 'error', `Erro na sincronizacao: ${message}`);

    return {
      success: false,
      documentsProcessed: totalDocumentsFetched,
      documentsImported: totalDocumentsImported,
      creditsCreated: totalCredits,
      error: message,
    };
  } finally {
    // ★ GARANTIA FINAL: Se ainda temos o lock, liberá-lo
    if (lockAcquired) {
      console.error('[SYNC] ★ FINALLY: Lock ainda estava ativo, liberando...');
      try {
        await supabase.updateSyncState(empresaId, {
          status: 'error',
          last_error: 'Sincronizacao interrompida inesperadamente',
        });
        console.log('[SYNC] Lock liberado no finally');
      } catch (finallyError) {
        console.error('[SYNC] Falha ao liberar lock no finally:', finallyError);
      }
      await supabase.log(empresaId, 'error', 'Sincronizacao interrompida inesperadamente (finally cleanup)');
    }
  }
}

/**
 * Endpoint para sincronizar empresa especifica
 */
 app.post('/sync', authMiddleware, async (req: Request, res: Response) => {
  const { empresa_id } = req.body;

  if (!empresa_id) {
    res.status(400).json({ error: 'empresa_id obrigatorio' });
    return;
  }

  // Log imediato para confirmar recebimento
  console.log(`[SYNC] ========================================`);
  console.log(`[SYNC] Recebido request para empresa ${empresa_id}`);
  console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log(`[SYNC] ========================================`);

  // Executar sync em background MAS com tratamento de erro visível
  syncEmpresa(empresa_id).catch(async (err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[SYNC] ========================================');
    console.error('[SYNC] ERRO NAO TRATADO NO BACKGROUND:');
    console.error(`[SYNC] Empresa: ${empresa_id}`);
    console.error(`[SYNC] Erro: ${errorMessage}`);
    console.error('[SYNC] Stack:', err instanceof Error ? err.stack : 'N/A');
    console.error('[SYNC] ========================================');
    
    // Tentar registrar no Supabase mesmo em caso de erro fatal
    try {
      await supabase.log(empresa_id, 'error', `Erro fatal nao tratado: ${errorMessage}`);
      await supabase.updateSyncState(empresa_id, {
        status: 'error',
        last_error: `Erro fatal: ${errorMessage}`,
      });
      console.log('[SYNC] Erro registrado no Supabase com sucesso');
    } catch (logError) {
      console.error('[SYNC] Falha ao registrar erro no Supabase:', logError);
    }
  });

  res.json({ message: 'Sincronizacao iniciada', empresa_id });
});

/**
 * Endpoint para sincronizar todas as empresas
 */
 app.post('/sync-all', authMiddleware, async (_req: Request, res: Response) => {
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
  console.log(`Janela: Bootstrap 30d | Diário 24h`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Delay entre requests: ${REQUEST_DELAY_MS}ms (±${REQUEST_DELAY_JITTER * 100}% jitter)`);
  console.log(`Threshold bootstrap stop: ${BOOTSTRAP_STOP_THRESHOLD} lotes`);
  console.log(`Rate limit: retry apenas na próxima 00:00 BRT`);
  console.log(`Max requests por run: ${MAX_SEFAZ_REQUESTS_PER_RUN}`);
  console.log(`Max runtime: ${MAX_RUNTIME_MS / 1000}s`);
  console.log('===========================================');
});
