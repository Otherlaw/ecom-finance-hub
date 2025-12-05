// Web Worker para geração de hashes SHA256 em paralelo
// Evita bloquear a UI durante processamento de grandes volumes

export interface HashWorkerMessage {
  type: 'process' | 'cancel';
  transacoes?: {
    data_transacao: string;
    descricao: string;
    pedido_id: string | null;
    valor_liquido: number;
    tipo_transacao: string;
  }[];
  batchSize?: number;
}

export interface HashWorkerResponse {
  type: 'progress' | 'complete' | 'error';
  processed?: number;
  total?: number;
  hashes?: string[];
  error?: string;
}

// Função para gerar hash SHA256 (executada no Worker)
async function gerarHash(params: {
  data_transacao: string;
  descricao: string;
  pedido_id: string | null;
  valor_liquido: number;
  tipo_transacao: string;
}): Promise<string> {
  const texto = [
    params.data_transacao || '',
    params.descricao || '',
    params.pedido_id || '',
    Number(params.valor_liquido || 0).toFixed(2),
    params.tipo_transacao || '',
  ].join('|');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 64);
}

// Código do worker como string para ser executado inline
export const hashWorkerCode = `
async function gerarHash(params) {
  const texto = [
    params.data_transacao || '',
    params.descricao || '',
    params.pedido_id || '',
    Number(params.valor_liquido || 0).toFixed(2),
    params.tipo_transacao || '',
  ].join('|');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 64);
}

let cancelado = false;

self.onmessage = async function(e) {
  const { type, transacoes, batchSize = 500 } = e.data;
  
  if (type === 'cancel') {
    cancelado = true;
    return;
  }
  
  if (type !== 'process' || !transacoes) return;
  
  cancelado = false;
  const total = transacoes.length;
  const hashes = [];
  
  try {
    for (let i = 0; i < total; i++) {
      if (cancelado) {
        self.postMessage({ type: 'error', error: 'Processamento cancelado' });
        return;
      }
      
      const hash = await gerarHash(transacoes[i]);
      hashes.push(hash);
      
      // Reportar progresso a cada batch
      if ((i + 1) % batchSize === 0 || i === total - 1) {
        self.postMessage({
          type: 'progress',
          processed: i + 1,
          total: total
        });
      }
    }
    
    self.postMessage({
      type: 'complete',
      hashes: hashes,
      processed: total,
      total: total
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Erro ao processar hashes'
    });
  }
};
`;

// Classe helper para usar o worker
export class HashWorkerManager {
  private worker: Worker | null = null;
  private resolvePromise: ((hashes: string[]) => void) | null = null;
  private rejectPromise: ((error: Error) => void) | null = null;
  private onProgress: ((processed: number, total: number) => void) | null = null;

  constructor() {
    this.createWorker();
  }

  private createWorker() {
    const blob = new Blob([hashWorkerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    this.worker = new Worker(url);
    
    this.worker.onmessage = (e: MessageEvent<HashWorkerResponse>) => {
      const { type, processed, total, hashes, error } = e.data;
      
      if (type === 'progress' && this.onProgress && processed !== undefined && total !== undefined) {
        this.onProgress(processed, total);
      } else if (type === 'complete' && this.resolvePromise && hashes) {
        this.resolvePromise(hashes);
        this.cleanup();
      } else if (type === 'error' && this.rejectPromise) {
        this.rejectPromise(new Error(error || 'Erro desconhecido'));
        this.cleanup();
      }
    };

    this.worker.onerror = (e) => {
      if (this.rejectPromise) {
        this.rejectPromise(new Error(e.message));
        this.cleanup();
      }
    };
  }

  async processHashes(
    transacoes: HashWorkerMessage['transacoes'],
    onProgress?: (processed: number, total: number) => void
  ): Promise<string[]> {
    if (!this.worker) {
      this.createWorker();
    }

    this.onProgress = onProgress || null;

    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
      
      this.worker?.postMessage({
        type: 'process',
        transacoes,
        batchSize: 200, // Reportar progresso a cada 200 registros
      });
    });
  }

  cancel() {
    this.worker?.postMessage({ type: 'cancel' });
  }

  private cleanup() {
    this.resolvePromise = null;
    this.rejectPromise = null;
    this.onProgress = null;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.cleanup();
  }
}

// Singleton para reutilizar o worker
let workerInstance: HashWorkerManager | null = null;

export function getHashWorker(): HashWorkerManager {
  if (!workerInstance) {
    workerInstance = new HashWorkerManager();
  }
  return workerInstance;
}

export function terminateHashWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
