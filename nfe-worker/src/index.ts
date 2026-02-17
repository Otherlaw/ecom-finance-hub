/**
 * NFe Worker - Entry Point (V2)
 * 
 * Sincronização NF-e via Distribuição DF-e
 * 
 * Regras V2:
 * - Não importar histórico antigo automaticamente
 * - first_success_at marca quando o sistema "começou a valer"
 * - Cutoff = first_success_at - 24h (tolerância)
 * - NSU SEMPRE avança, mesmo quando docs são ignorados
 * - Manifestação (Ciência) é enfileirada na manifest_queue
 * - Erro 656: next_retry_at = próxima 00:00 BRT
 * - 1x por dia às 00:00 BRT (cron)
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { SupabaseWorkerClient } from './supabase-client.js';
import { SefazClient } from './sefaz-client.js';
import { decrypt } from './crypto.js';
import type { IngestResponse } from './types.js';
import { computeCutoffDate, getNextMidnightBRT } from './sync-utils.js';

// Configuracoes
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const WORKER_INGEST_TOKEN = process.env.WORKER_INGEST_TOKEN!;
const CERT_MASTER_KEY = process.env.CERT_MASTER_KEY!;

// Parametros de sincronizacao
const BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 12000;
const REQUEST_DELAY_JITTER = 0.25;
const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

// Anti-rate-limit
const MAX_SEFAZ_REQUESTS_PER_RUN = 10;
const MAX_RUNTIME_MS = 4 * 60 * 1000; // 4 min
const MIN_TIME_BETWEEN_RUNS_MS = 3 * 60 * 1000; // 3 min

// Validar configuracoes
const missingVars: string[] = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!WORKER_INGEST_TOKEN) missingVars.push('WORKER_INGEST_TOKEN');
if (!CERT_MASTER_KEY) missingVars.push('CERT_MASTER_KEY');

if (missingVars.length > 0) {
  console.error('ERRO: Variaveis faltando:', missingVars.join(', '));
  process.exit(1);
}

const supabase = new SupabaseWorkerClient(SUPABASE_URL, WORKER_INGEST_TOKEN);
const app = express();
app.use(express.json());

// Auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const syncToken = req.headers['x-worker-sync-token'];
  if (!syncToken || syncToken !== WORKER_INGEST_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function isSefazError656(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('656') || error.message.includes('Consumo Indevido');
  }
  return false;
}

function getDelayWithJitter(): number {
  const jitterFactor = 1 + (Math.random() * 2 - 1) * REQUEST_DELAY_JITTER;
  return Math.round(REQUEST_DELAY_MS * jitterFactor);
}

function isLastSefazRequestTooRecent(lastSefazRequestAt: string | null): boolean {
  if (!lastSefazRequestAt) return false;
  const lastRequest = new Date(lastSefazRequestAt);
  const now = new Date();
  return (now.getTime() - lastRequest.getTime()) < MIN_TIME_BETWEEN_RUNS_MS;
}

/**
 * Sincroniza uma empresa especifica (V2)
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
  console.log(`[SYNC] ========================================`);
  console.log(`[SYNC] Iniciando syncEmpresa V2 para empresa ${empresaId}`);
  console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log(`[SYNC] ========================================`);

  try {
    await supabase.log(empresaId, 'info', 'Worker V2 iniciou sincronização');
  } catch (logError) {
    console.error('[SYNC] Erro ao registrar log inicial:', logError);
  }

  let lockAcquired = false;
  let currentNSU = 0;
  let maxNSU = 0;
  let totalDocumentsFetched = 0;
  let totalDocumentsImported = 0;
  let totalCredits = 0;
  let sefazRequestCount = 0;
  const runStartTime = Date.now();
  let firstSuccessAt: string | null = null;

  try {
    // Buscar certificado
    console.log('[SYNC] Buscando certificado...');
    const certificate = await supabase.getCertificate(empresaId);
    if (!certificate) {
      throw new Error('Certificado nao encontrado');
    }
    console.log('[SYNC] Certificado encontrado');

    // Buscar estado atual
    const syncState = await supabase.getSyncState(empresaId);
    console.log(`[SYNC] Estado: status=${syncState?.status}, ult_nsu=${syncState?.ult_nsu}, first_success_at=${syncState?.first_success_at}`);

    // Guardar first_success_at atual
    firstSuccessAt = syncState?.first_success_at || null;

    // ========================================
    // BLOQUEIOS
    // ========================================
    if (syncState) {
      // 1) Cooldown
      if (syncState.next_retry_at) {
        const nextRetry = new Date(syncState.next_retry_at);
        if (new Date() < nextRetry) {
          const msg = `Bloqueio de cooldown ativo até ${syncState.next_retry_at}`;
          console.log(`[SYNC] BLOQUEADO: ${msg}`);
          await supabase.log(empresaId, 'warn', msg);
          return { success: false, documentsProcessed: 0, documentsImported: 0, creditsCreated: 0, error: msg, rateLimited: true };
        }
        await supabase.log(empresaId, 'info', 'Cooldown expirou, retomando');
      }

      // 2) Throttle
      if (isLastSefazRequestTooRecent(syncState.last_sefaz_request_at || null)) {
        const msg = `Última requisição SEFAZ muito recente. Aguarde.`;
        console.log(`[SYNC] BLOQUEADO: ${msg}`);
        await supabase.updateSyncState(empresaId, { status: 'idle', last_error: msg });
        return { success: false, documentsProcessed: 0, documentsImported: 0, creditsCreated: 0, error: msg, paused: true, pauseReason: 'throttle' };
      }

      // 3) Concurrency lock
      if (syncState.status === 'running') {
        const updatedAt = new Date(syncState.updated_at);
        const diffMinutes = (new Date().getTime() - updatedAt.getTime()) / 60000;
        if (diffMinutes < 30) {
          const msg = `Sync já em andamento (há ${Math.round(diffMinutes)} min)`;
          console.log(`[SYNC] BLOQUEADO: ${msg}`);
          return { success: false, documentsProcessed: 0, documentsImported: 0, creditsCreated: 0, error: msg };
        }
        await supabase.log(empresaId, 'warn', 'Sync anterior expirou (timeout 30min), reiniciando');
      }

      currentNSU = syncState.ult_nsu || 0;
      maxNSU = syncState.max_nsu || 0;
    }

    // ★ Computar cutoff baseado em first_success_at
    const cutoffDate = computeCutoffDate(firstSuccessAt);
    const isFirstRun = !firstSuccessAt;

    await supabase.log(empresaId, 'info',
      isFirstRun
        ? `Primeira sincronização. Importando documentos recentes (cutoff: ontem).`
        : `Sincronização contínua. Cutoff: ${cutoffDate}${DRY_RUN ? ' [DRY_RUN]' : ''}`
    );
    console.log(`[SYNC] firstSuccessAt=${firstSuccessAt}, cutoff=${cutoffDate}, NSU=${currentNSU}${DRY_RUN ? ' [DRY_RUN]' : ''}`);

    // Setar status = running
    await supabase.updateSyncState(empresaId, {
      status: 'running',
      next_retry_at: null,
      last_error: null,
    });
    lockAcquired = true;

    // Descriptografar certificado
    let pfxBase64 = certificate.cert_pfx_encrypted;
    let password = certificate.cert_password_encrypted;
    if (CERT_MASTER_KEY && certificate.cert_pfx_encrypted.length > 100) {
      try {
        pfxBase64 = decrypt(certificate.cert_pfx_encrypted, CERT_MASTER_KEY);
        password = decrypt(certificate.cert_password_encrypted, CERT_MASTER_KEY);
        console.log('[SYNC] Certificado descriptografado via CERT_MASTER_KEY');
      } catch {
        console.log('[SYNC] Usando certificado como base64 puro');
        pfxBase64 = certificate.cert_pfx_encrypted;
        password = certificate.cert_password_encrypted;
      }
    }

    // Validar PFX
    const testBuffer = Buffer.from(pfxBase64, 'base64');
    if (testBuffer.length < 100) {
      throw new Error(`Certificado PFX muito pequeno (${testBuffer.length} bytes)`);
    }
    console.log(`[SYNC] PFX: ${testBuffer.length} bytes`);

    const sefaz = new SefazClient(pfxBase64, password, certificate.ambiente, certificate.uf);

    let hasMore = true;
    let pauseReason: string | null = null;

    while (hasMore) {
      // Limites de proteção
      const elapsedMs = Date.now() - runStartTime;
      if (elapsedMs >= MAX_RUNTIME_MS) {
        pauseReason = `Tempo máximo atingido (${Math.round(elapsedMs / 1000)}s)`;
        console.log(`[SYNC] ★ PAUSA: ${pauseReason}`);
        await supabase.log(empresaId, 'info', pauseReason, { ult_nsu: currentNSU, max_nsu: maxNSU });
        break;
      }
      if (sefazRequestCount >= MAX_SEFAZ_REQUESTS_PER_RUN) {
        pauseReason = `Limite de ${MAX_SEFAZ_REQUESTS_PER_RUN} requests atingido`;
        console.log(`[SYNC] ★ PAUSA: ${pauseReason}`);
        await supabase.log(empresaId, 'info', pauseReason, { ult_nsu: currentNSU, max_nsu: maxNSU });
        break;
      }

      console.log(`[SYNC] [${sefazRequestCount + 1}/${MAX_SEFAZ_REQUESTS_PER_RUN}] NSU ${currentNSU}...`);

      try {
        // Registrar timestamp antes da chamada
        await supabase.updateSyncState(empresaId, {
          last_sefaz_request_at: new Date().toISOString(),
        });

        const result = await sefaz.consultarDistribuicao(certificate.cnpj, currentNSU);
        sefazRequestCount++;

        // ★ PERSISTIR NSU CEDO
        currentNSU = result.ultNSU;
        maxNSU = result.maxNSU;
        hasMore = result.hasMore;

        console.log(`[SYNC] SEFAZ: ${result.documents.length} docs, ultNSU=${currentNSU}, maxNSU=${maxNSU}`);

        // ★ PERSISTIR NSU imediatamente
        await supabase.updateSyncState(empresaId, {
          ult_nsu: currentNSU,
          max_nsu: maxNSU,
        });

        // ★ DEFINIR first_success_at se ainda não existe
        if (!firstSuccessAt) {
          firstSuccessAt = new Date().toISOString();
          await supabase.updateSyncState(empresaId, {
            first_success_at: firstSuccessAt,
            sync_mode: 'daily',
            bootstrap_completed_at: firstSuccessAt, // backward compat
          });
          await supabase.log(empresaId, 'info', `★ first_success_at definido: ${firstSuccessAt}. Sistema ativado.`);
          console.log(`[SYNC] ★ first_success_at = ${firstSuccessAt}`);

          // Recomputar cutoff agora que temos first_success_at
        }

        // Recalcular cutoff com first_success_at (pode ter sido setado agora)
        const currentCutoff = computeCutoffDate(firstSuccessAt);

        // cStat 137 (sem docs novos)
        if (result.documents.length === 0 && !hasMore) {
          const nextRetryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          const msg = `SEFAZ: sem documentos novos. Próxima tentativa em 1h.`;
          console.log(`[SYNC] ${msg}`);
          await supabase.log(empresaId, 'info', msg, { ult_nsu: currentNSU, max_nsu: maxNSU });

          await supabase.updateSyncState(empresaId, {
            status: 'idle',
            last_sync_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            last_error: null,
            next_retry_at: nextRetryAt,
            ult_nsu: currentNSU,
            max_nsu: maxNSU,
            documents_fetched: totalDocumentsFetched,
            credits_created: totalCredits,
            rate_limit_count: 0,
          });

          lockAcquired = false;
          return {
            success: true,
            documentsProcessed: totalDocumentsFetched,
            documentsImported: totalDocumentsImported,
            creditsCreated: totalCredits,
          };
        }

        if (result.documents.length > 0) {
          // ★ Enviar para ingest com cutoff
          for (let i = 0; i < result.documents.length; i += BATCH_SIZE) {
            const batch = result.documents.slice(i, i + BATCH_SIZE);

            try {
              const ingestResult: IngestResponse = await supabase.ingestDocuments({
                empresa_id: empresaId,
                documents: batch,
                cutoff_date: currentCutoff,
                dry_run: DRY_RUN,
              });

              totalDocumentsFetched += ingestResult.total_in_batch;
              totalDocumentsImported += ingestResult.inserted;
              totalCredits += ingestResult.credits_created;

              const logMsg = `Lote: ${ingestResult.inserted} importados, ${ingestResult.skipped_old} antigos, ${ingestResult.duplicates} dup, ${ingestResult.credits_created} créditos`;
              console.log(`[SYNC] ${logMsg}`);
              await supabase.log(empresaId, 'info', logMsg);

              // ★ ENFILEIRAR MANIFESTAÇÃO para resumos (resNFe) DENTRO do cutoff
              const resumos = batch.filter(
                (d) => d.access_key && d.access_key.length === 44 &&
                       d.schema !== 'procNFe_v4.00' && !d.schema.includes('procNFe')
              );

              if (resumos.length > 0 && currentCutoff) {
                console.log(`[SYNC] Enfileirando ${resumos.length} resumos na manifest_queue`);
                for (const resumo of resumos) {
                  try {
                    await supabase.enqueueManifest(empresaId, resumo.access_key);
                  } catch (mqError) {
                    console.error(`[SYNC] Erro ao enfileirar manifest ${resumo.access_key}:`, mqError);
                  }
                }
                await supabase.log(empresaId, 'info', `${resumos.length} resumos enfileirados para Ciência da Operação`);
              }
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              console.error('[SYNC] Erro no ingest:', errMsg);
              await supabase.log(empresaId, 'error', `Erro no ingest: ${errMsg}`);
            }
          }
        }

        // Atualizar contadores
        await supabase.updateSyncState(empresaId, {
          documents_fetched: totalDocumentsFetched,
          credits_created: totalCredits,
        });

        // Delay
        if (hasMore) {
          const delay = getDelayWithJitter();
          console.log(`[SYNC] Aguardando ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        // Erro 656
        if (isSefazError656(error)) {
          const nextRetryAt = getNextMidnightBRT();
          const currentRateLimitCount = (syncState?.rate_limit_count || 0) + 1;
          const shouldStop = currentRateLimitCount >= 5;
          const errorMsg = shouldStop
            ? `Erro 656 após ${currentRateLimitCount} tentativas. Sync pausado.`
            : `Erro 656: Consumo Indevido. Próxima tentativa: 00:00 BRT (#${currentRateLimitCount}).`;

          console.error(`[SYNC] ★ ERRO 656: ${errorMsg}`);
          await supabase.log(empresaId, 'error', errorMsg, { ult_nsu: currentNSU, max_nsu: maxNSU, next_retry_at: nextRetryAt });

          await supabase.updateSyncState(empresaId, {
            status: shouldStop ? 'error' : 'rate_limited',
            last_error: errorMsg,
            ult_nsu: currentNSU,
            max_nsu: maxNSU,
            next_retry_at: shouldStop ? null : nextRetryAt,
            rate_limit_count: currentRateLimitCount,
            last_rate_limit_at: new Date().toISOString(),
          });

          lockAcquired = false;
          return { success: false, documentsProcessed: totalDocumentsFetched, documentsImported: totalDocumentsImported, creditsCreated: totalCredits, error: errorMsg, rateLimited: true };
        }
        throw error;
      }
    }

    // ★ PROCESSAR MANIFEST QUEUE (background, não trava o loop)
    try {
      await processManifestQueue(empresaId, sefaz, certificate.cnpj);
    } catch (mqErr) {
      console.error('[SYNC] Erro ao processar manifest_queue:', mqErr);
      await supabase.log(empresaId, 'warn', `Erro no processamento da manifest_queue: ${mqErr instanceof Error ? mqErr.message : String(mqErr)}`);
    }

    // Finalizar
    const elapsedMs = Date.now() - runStartTime;

    if (pauseReason) {
      await supabase.updateSyncState(empresaId, {
        status: 'idle',
        last_error: pauseReason,
        next_retry_at: null,
        ult_nsu: currentNSU,
        max_nsu: maxNSU,
        documents_fetched: totalDocumentsFetched,
        credits_created: totalCredits,
        rate_limit_count: 0,
      });
      lockAcquired = false;
      const msg = `Pausado: ${pauseReason} (${sefazRequestCount} requests em ${Math.round(elapsedMs / 1000)}s)`;
      await supabase.log(empresaId, 'info', msg);
      return { success: true, documentsProcessed: totalDocumentsFetched, documentsImported: totalDocumentsImported, creditsCreated: totalCredits, paused: true, pauseReason };
    }

    // Sucesso completo
    const finishMsg = `Sync V2 concluído: ${totalDocumentsImported} importados, ${totalCredits} créditos (${sefazRequestCount} req em ${Math.round(elapsedMs / 1000)}s)`;
    await supabase.updateSyncState(empresaId, {
      status: 'idle',
      last_sync_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      next_retry_at: null,
      ult_nsu: currentNSU,
      max_nsu: maxNSU,
      documents_fetched: totalDocumentsFetched,
      credits_created: totalCredits,
      rate_limit_count: 0,
    });

    lockAcquired = false;
    await supabase.log(empresaId, 'info', finishMsg);
    console.log(`[SYNC] ${finishMsg}`);

    return { success: true, documentsProcessed: totalDocumentsFetched, documentsImported: totalDocumentsImported, creditsCreated: totalCredits };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SYNC] Erro fatal: ${message}`);

    try {
      await supabase.updateSyncState(empresaId, { status: 'error', last_error: message });
      lockAcquired = false;
    } catch (updateError) {
      console.error('[SYNC] Falha ao liberar lock:', updateError);
    }

    await supabase.log(empresaId, 'error', `Erro fatal: ${message}`);
    return { success: false, documentsProcessed: totalDocumentsFetched, documentsImported: totalDocumentsImported, creditsCreated: totalCredits, error: message };
  } finally {
    if (lockAcquired) {
      console.error('[SYNC] ★ FINALLY: Lock ativo, liberando...');
      try {
        await supabase.updateSyncState(empresaId, { status: 'error', last_error: 'Sync interrompida inesperadamente' });
      } catch (finallyError) {
        console.error('[SYNC] Falha no finally:', finallyError);
      }
      await supabase.log(empresaId, 'error', 'Sync interrompida inesperadamente (finally)');
    }
  }
}

/**
 * Processa fila de manifestação (Ciência da Operação)
 * Executa em segundo plano, erros não travam o sync principal
 */
async function processManifestQueue(empresaId: string, sefaz: SefazClient, cnpj: string) {
  const pending = await supabase.getPendingManifests(empresaId, 5);
  if (!pending || pending.length === 0) return;

  console.log(`[MANIFEST] Processando ${pending.length} itens na fila`);

  for (const item of pending) {
    try {
      const ok = await sefaz.manifestarCiencia(cnpj, item.ch_nfe);
      if (ok) {
        await supabase.updateManifestStatus(item.id, 'success');
        console.log(`[MANIFEST] Ciência OK: ${item.ch_nfe}`);
      } else {
        const attempts = (item.attempts || 0) + 1;
        const nextTryAt = new Date(Date.now() + Math.min(Math.pow(2, attempts) * 60 * 60 * 1000, 24 * 60 * 60 * 1000)).toISOString();
        await supabase.updateManifestStatus(item.id, attempts >= item.max_attempts ? 'error' : 'pending', 'Rejeitado pela SEFAZ', attempts, nextTryAt);
        console.log(`[MANIFEST] Rejeitado: ${item.ch_nfe} (attempt ${attempts})`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const attempts = (item.attempts || 0) + 1;
      const nextTryAt = new Date(Date.now() + Math.min(Math.pow(2, attempts) * 60 * 60 * 1000, 24 * 60 * 60 * 1000)).toISOString();
      await supabase.updateManifestStatus(item.id, attempts >= item.max_attempts ? 'error' : 'pending', errMsg, attempts, nextTryAt);
      console.error(`[MANIFEST] Erro ${item.ch_nfe}: ${errMsg}`);
    }
  }
}

// ========================================
// ENDPOINTS
// ========================================

app.post('/sync', authMiddleware, async (req: Request, res: Response) => {
  const { empresa_id } = req.body;
  if (!empresa_id) {
    res.status(400).json({ error: 'empresa_id obrigatorio' });
    return;
  }

  console.log(`[SYNC] Recebido request para empresa ${empresa_id}`);

  syncEmpresa(empresa_id).catch(async (err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[SYNC] ERRO BACKGROUND: ${errorMessage}`);
    try {
      await supabase.log(empresa_id, 'error', `Erro fatal: ${errorMessage}`);
      await supabase.updateSyncState(empresa_id, { status: 'error', last_error: `Erro fatal: ${errorMessage}` });
    } catch (logError) {
      console.error('[SYNC] Falha ao registrar erro:', logError);
    }
  });

  res.json({ message: 'Sincronizacao iniciada', empresa_id });
});

app.post('/sync-all', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const companies = await supabase.getActiveCompanies();
    console.log(`[SYNC-ALL] ${companies.length} empresas`);

    for (const company of companies) {
      await syncEmpresa(company.empresa_id);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    res.json({ message: 'Concluido', count: companies.length });
  } catch (error) {
    console.error('[SYNC-ALL] Erro:', error);
    res.status(500).json({ error: 'Erro ao sincronizar' });
  }
});

app.listen(PORT, () => {
  console.log('===========================================');
  console.log(`NFe Worker V2 na porta ${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Modo: first_success_at cutoff (sem histórico)`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Max requests/run: ${MAX_SEFAZ_REQUESTS_PER_RUN}`);
  console.log(`Max runtime: ${MAX_RUNTIME_MS / 1000}s`);
  console.log('===========================================');
});
