/**
 * Cliente para comunicação com Supabase via Edge Function Proxy
 * V2: Inclui manifest_queue operations
 */

import type { NfeCertificate, NfeSyncState, IngestPayload, IngestResponse } from './types.js';

export interface ManifestQueueItem {
  id: string;
  empresa_id: string;
  ch_nfe: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_try_at: string | null;
  last_error: string | null;
}

export class SupabaseWorkerClient {
  private supabaseUrl: string;
  private ingestToken: string;

  constructor(supabaseUrl: string, ingestToken: string) {
    this.supabaseUrl = supabaseUrl;
    this.ingestToken = ingestToken;
  }

  async getActiveCompanies(): Promise<Array<{ empresa_id: string; cnpj: string; uf: string; ambiente: string }>> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-active-companies`,
      { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken } }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar empresas');
    }
    const data = await response.json();
    return data.companies || [];
  }

  async getCertificate(empresaId: string): Promise<NfeCertificate | null> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-certificate&empresa_id=${encodeURIComponent(empresaId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken } }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar certificado');
    }
    const data = await response.json();
    return data.certificate || null;
  }

  async getSyncState(empresaId: string): Promise<NfeSyncState | null> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-sync-state&empresa_id=${encodeURIComponent(empresaId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken } }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar estado');
    }
    const data = await response.json();
    return data.sync_state || null;
  }

  async updateSyncState(empresaId: string, updates: Partial<NfeSyncState>): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=update-sync-state`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken },
        body: JSON.stringify({ empresa_id: empresaId, updates }),
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar estado');
    }
  }

  async log(empresaId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, unknown>): Promise<void> {
    try {
      await fetch(
        `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=log`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken },
          body: JSON.stringify({ empresa_id: empresaId, level, message, meta }),
        }
      );
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }

  async ingestDocuments(payload: IngestPayload): Promise<IngestResponse> {
    const url = `${this.supabaseUrl}/functions/v1/nfe-ingest`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let bodyText: string;
      try { bodyText = await response.text(); } catch { bodyText = '(body ilegível)'; }
      throw new Error(`Ingest falhou (${response.status}): ${bodyText}`);
    }

    let resultText: string;
    try { resultText = await response.text(); } catch { throw new Error(`Ingest OK mas body ilegível`); }
    try { return JSON.parse(resultText) as IngestResponse; } catch { throw new Error(`Ingest OK mas não é JSON: ${resultText.substring(0, 500)}`); }
  }

  // ★ MANIFEST QUEUE OPERATIONS

  async enqueueManifest(empresaId: string, chNFe: string): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=enqueue-manifest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken },
        body: JSON.stringify({ empresa_id: empresaId, ch_nfe: chNFe }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || 'Erro ao enfileirar manifest');
    }
  }

  async getPendingManifests(empresaId: string, limit: number = 5): Promise<ManifestQueueItem[]> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-pending-manifests&empresa_id=${encodeURIComponent(empresaId)}&limit=${limit}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.manifests || [];
  }

  async updateManifestStatus(id: string, status: string, lastError?: string, attempts?: number, nextTryAt?: string): Promise<void> {
    await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=update-manifest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-token': this.ingestToken },
        body: JSON.stringify({ id, status, last_error: lastError, attempts, next_try_at: nextTryAt }),
      }
    );
  }
}
