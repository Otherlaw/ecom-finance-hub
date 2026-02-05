/**
 * Tipos para o NFe Worker
 */

export type NfeSyncStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'error'
  | 'completed'
  | 'rate_limited';

export interface NfeCertificate {
  id: string;
  empresa_id: string;
  cnpj: string;
  cert_pfx_encrypted: string;
  cert_password_encrypted: string;
  is_active: boolean;
  ambiente: 'producao' | 'homologacao';
  uf: string;
  created_at: string;
  updated_at: string;
}

export interface NfeSyncState {
  empresa_id: string;
  ult_nsu: number;
  max_nsu: number;
  last_sync_at: string | null;
  status: NfeSyncStatus;
  last_error: string | null;
  documents_fetched: number;
  credits_created: number;
  updated_at: string;
  next_retry_at: string | null;
  // Campos para throttle/backoff
  last_sefaz_request_at?: string | null;
  rate_limit_count?: number | null;
  last_rate_limit_at?: string | null;
}

export interface NfeDocument {
  access_key: string;
  nsu: number;
  schema: string;
  xml?: string;
}

export interface IngestPayload {
  empresa_id: string;
  documents: NfeDocument[];
}

/**
 * Resposta do endpoint de ingestao
 * Inclui contadores para logica de bootstrap no worker
 */
export interface IngestResponse {
  success: boolean;
  inserted: number;
  duplicates: number;
  credits_created: number;
  // Campos adicionais para logica de bootstrap
  skipped_old: number;
  skipped_no_xml: number;
  total_in_batch: number;
  errors?: string[];
}

export interface DistDFeResponse {
  cStat: string;
  xMotivo: string;
  ultNSU: number;
  maxNSU: number;
  docZip: Array<{
    NSU: string;
    schema: string;
    content: string; // Base64 gzipped XML
  }>;
}

// Endpoints da SEFAZ por UF/Ambiente
export const SEFAZ_ENDPOINTS: Record<string, Record<string, string>> = {
  AN: {
    producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
    homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  },
};

// WSDL para Distribuicao DF-e
export const WSDL_URL = {
  producao: 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?WSDL',
  homologacao: 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?WSDL',
};
