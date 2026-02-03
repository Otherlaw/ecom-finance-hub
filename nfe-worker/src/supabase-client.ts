/**
 * Cliente para comunicação com Supabase via Edge Function Proxy
 * 
 * Não usa SDK Supabase diretamente - todas as operações passam pelo nfe-worker-proxy
 * para evitar necessidade de SUPABASE_SERVICE_ROLE_KEY no worker externo.
 */

import type { NfeCertificate, NfeSyncState, IngestPayload, IngestResponse } from './types.js';

export class SupabaseWorkerClient {
  private supabaseUrl: string;
  private ingestToken: string;

  constructor(supabaseUrl: string, ingestToken: string) {
    this.supabaseUrl = supabaseUrl;
    this.ingestToken = ingestToken;
  }

  /**
   * Busca todas as empresas com certificados ativos
   */
  async getActiveCompanies(): Promise<Array<{ empresa_id: string; cnpj: string; uf: string; ambiente: string }>> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-active-companies`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.ingestToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar empresas ativas:', error);
      throw new Error(error.error || 'Erro ao buscar empresas');
    }

    const data = await response.json();
    return data.companies || [];
  }

  /**
   * Busca certificado de uma empresa
   */
  async getCertificate(empresaId: string): Promise<NfeCertificate | null> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-certificate&empresa_id=${encodeURIComponent(empresaId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.ingestToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar certificado:', error);
      throw new Error(error.error || 'Erro ao buscar certificado');
    }

    const data = await response.json();
    return data.certificate || null;
  }

  /**
   * Busca estado de sincronizacao
   */
  async getSyncState(empresaId: string): Promise<NfeSyncState | null> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-sync-state&empresa_id=${encodeURIComponent(empresaId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.ingestToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar sync state:', error);
      throw new Error(error.error || 'Erro ao buscar estado de sincronização');
    }

    const data = await response.json();
    return data.sync_state || null;
  }

  /**
   * Atualiza estado de sincronizacao
   */
  async updateSyncState(empresaId: string, updates: Partial<NfeSyncState>): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=update-sync-state`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-token': this.ingestToken,
        },
        body: JSON.stringify({
          empresa_id: empresaId,
          updates,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao atualizar sync state:', error);
      throw new Error(error.error || 'Erro ao atualizar estado');
    }
  }

  /**
   * Registra log de sincronizacao
   */
  async log(
    empresaId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=log`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-token': this.ingestToken,
          },
          body: JSON.stringify({
            empresa_id: empresaId,
            level,
            message,
            meta,
          }),
        }
      );

      if (!response.ok) {
        console.error('Erro ao registrar log');
      }
    } catch (error) {
      // Não propaga erro de log para não interromper o fluxo
      console.error('Erro ao registrar log:', error);
    }
  }

  /**
   * Envia documentos para o endpoint de ingestao
   */
  async ingestDocuments(payload: IngestPayload): Promise<IngestResponse> {
    const response = await fetch(`${this.supabaseUrl}/functions/v1/nfe-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-token': this.ingestToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro na ingestao');
    }

    return response.json();
  }
}
