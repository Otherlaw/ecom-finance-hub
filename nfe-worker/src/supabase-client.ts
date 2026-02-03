/**
 * Cliente Supabase para o NFe Worker
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NfeCertificate, NfeSyncState, IngestPayload, IngestResponse } from './types.js';

export class SupabaseWorkerClient {
  private client: SupabaseClient;
  private ingestToken: string;

  constructor(url: string, serviceRoleKey: string, ingestToken: string) {
    this.client = createClient(url, serviceRoleKey);
    this.ingestToken = ingestToken;
  }

  /**
   * Busca todas as empresas com certificados ativos
   */
  async getActiveCompanies(): Promise<NfeCertificate[]> {
    const { data, error } = await this.client
      .from('nfe_certificates')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Erro ao buscar certificados:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Busca certificado de uma empresa
   */
  async getCertificate(empresaId: string): Promise<NfeCertificate | null> {
    const { data, error } = await this.client
      .from('nfe_certificates')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Busca estado de sincronizacao
   */
  async getSyncState(empresaId: string): Promise<NfeSyncState | null> {
    const { data, error } = await this.client
      .from('nfe_sync_state')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Atualiza estado de sincronizacao
   */
  async updateSyncState(empresaId: string, updates: Partial<NfeSyncState>): Promise<void> {
    const { error } = await this.client
      .from('nfe_sync_state')
      .upsert({
        empresa_id: empresaId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' });

    if (error) {
      console.error('Erro ao atualizar estado:', error);
      throw error;
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
    const { error } = await this.client
      .from('nfe_sync_logs')
      .insert({
        empresa_id: empresaId,
        level,
        message,
        meta,
      });

    if (error) {
      console.error('Erro ao registrar log:', error);
    }
  }

  /**
   * Envia documentos para o endpoint de ingestao
   */
  async ingestDocuments(payload: IngestPayload): Promise<IngestResponse> {
    const url = process.env.SUPABASE_URL;
    const response = await fetch(`${url}/functions/v1/nfe-ingest`, {
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
