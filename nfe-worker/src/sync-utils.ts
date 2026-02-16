/**
 * Utility functions for NF-e sync logic
 * Extracted for testability and clarity
 */

export interface SyncWindow {
  cutoffDate: string; // YYYY-MM-DD
  modeLabel: string;
}

export interface SyncState {
  bootstrap_completed_at?: string | null;
  sync_mode?: string;
  last_sync_at?: string | null;
  status?: string;
  next_retry_at?: string | null;
}

const BOOTSTRAP_WINDOW_DAYS = 30;
const DAILY_WINDOW_HOURS = 24;

/**
 * Computes the sync window (cutoff date) based on the current mode.
 * - Bootstrap: last 30 days
 * - Daily: last 24 hours
 */
export function computeSyncWindow(mode: 'bootstrap' | 'daily'): SyncWindow {
  const cutoff = new Date();
  if (mode === 'bootstrap') {
    cutoff.setDate(cutoff.getDate() - BOOTSTRAP_WINDOW_DAYS);
    return {
      cutoffDate: cutoff.toISOString().split('T')[0],
      modeLabel: `Bootstrap (últimos ${BOOTSTRAP_WINDOW_DAYS} dias)`,
    };
  } else {
    cutoff.setHours(cutoff.getHours() - DAILY_WINDOW_HOURS);
    return {
      cutoffDate: cutoff.toISOString().split('T')[0],
      modeLabel: `Diário (últimas ${DAILY_WINDOW_HOURS}h)`,
    };
  }
}

/**
 * Determines the sync mode based on sync state.
 * - If bootstrap_completed_at exists or sync_mode is 'daily' -> daily
 * - Otherwise -> bootstrap
 */
export function getSyncMode(syncState: SyncState | null): 'bootstrap' | 'daily' {
  if (!syncState) return 'bootstrap';
  if (syncState.bootstrap_completed_at) return 'daily';
  if (syncState.sync_mode === 'daily') return 'daily';
  return 'bootstrap';
}

/**
 * Determines if a sync should run now based on the current state.
 * 
 * Rules:
 * - Bootstrap: always run (until completed)
 * - Daily: only if hasn't run today (last_sync_at < start of today)
 * - Never run if status is 'running' or 'queued' (concurrency)
 * - Never run if next_retry_at is in the future (rate limit cooldown)
 */
export function shouldRunNow(syncState: SyncState | null): {
  shouldRun: boolean;
  reason: string;
} {
  if (!syncState) {
    return { shouldRun: true, reason: 'first_run' };
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

  const mode = getSyncMode(syncState);

  if (mode === 'bootstrap') {
    return { shouldRun: true, reason: 'bootstrap' };
  }

  // Daily mode: check if already ran today
  if (syncState.last_sync_at) {
    const lastSync = new Date(syncState.last_sync_at);
    const now = new Date();
    // Start of today in BRT (UTC-3) = 03:00 UTC
    const todayStart = new Date(now);
    todayStart.setUTCHours(3, 0, 0, 0);
    if (todayStart.getTime() > now.getTime()) {
      // Before 03:00 UTC today, use yesterday's midnight BRT
      todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }

    if (lastSync >= todayStart) {
      return { shouldRun: false, reason: 'already_ran_today' };
    }
  }

  return { shouldRun: true, reason: 'daily_due' };
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
