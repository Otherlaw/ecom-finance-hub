/**
 * Utility functions for NF-e sync logic
 * V2: first_success_at based cutoff (no more bootstrap/daily modes)
 */

export interface SyncState {
  first_success_at?: string | null;
  last_success_at?: string | null;
  last_sync_at?: string | null;
  status?: string;
  next_retry_at?: string | null;
  sync_enabled?: boolean;
  ult_nsu?: number;
  max_nsu?: number;
  bootstrap_completed_at?: string | null;
  sync_mode?: string;
}

/**
 * Computes the cutoff date for document ingestion.
 * - If first_success_at exists: first_success_at - 24h
 * - If not yet set (primeira sync): usa "ontem" como cutoff para importar NFs recentes
 * Nunca retorna null — sempre importa documentos.
 */
export function computeCutoffDate(firstSuccessAt: string | null | undefined): string {
  if (!firstSuccessAt) {
    // Primeira sync: usar ontem como cutoff (pega NFs recentes sem trazer historico longo)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    return yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  const date = new Date(firstSuccessAt);
  date.setHours(date.getHours() - 24); // 24h tolerance
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Determines if a sync should run now based on the current state.
 */
export function shouldRunNow(syncState: SyncState | null): {
  shouldRun: boolean;
  reason: string;
} {
  if (!syncState) {
    return { shouldRun: true, reason: 'first_run' };
  }

  if (!syncState.sync_enabled) {
    return { shouldRun: false, reason: 'sync_disabled' };
  }

  // Check concurrency lock
  if (syncState.status === 'running' || syncState.status === 'queued') {
    return { shouldRun: false, reason: 'already_running' };
  }

  // Check cooldown
  if (syncState.next_retry_at) {
    const nextRetry = new Date(syncState.next_retry_at);
    if (new Date() < nextRetry) {
      return { shouldRun: false, reason: `cooldown_until_${syncState.next_retry_at}` };
    }
  }

  // Daily mode: check if already ran today
  if (syncState.last_sync_at) {
    const lastSync = new Date(syncState.last_sync_at);
    const now = new Date();
    // Start of today in BRT (UTC-3) = 03:00 UTC
    const todayStart = new Date(now);
    todayStart.setUTCHours(3, 0, 0, 0);
    if (todayStart.getTime() > now.getTime()) {
      todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }

    if (lastSync >= todayStart) {
      return { shouldRun: false, reason: 'already_ran_today' };
    }
  }

  return { shouldRun: true, reason: 'due' };
}

/**
 * Computes the next midnight BRT (00:00 BRT = 03:00 UTC) for retry scheduling.
 */
export function getNextMidnightBRT(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}
