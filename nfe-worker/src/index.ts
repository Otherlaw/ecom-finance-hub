/**
 * NFe Worker - Entry Point
 * Servidor Express para sincronizacao de NF-e via Distribuicao DF-e
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { SupabaseWorkerClient } from './supabase-client.js';
import { SefazClient } from './sefaz-client.js';
import { decrypt } from './crypto.js';

// Configuracoes
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WORKER_INGEST_TOKEN = process.env.WORKER_INGEST_TOKEN!;
const CERT_MASTER_KEY = process.env.CERT_MASTER_KEY!;
const BATCH_SIZE = 50; // Maximo de docs por lote para ingestao
const REQUEST_DELAY_MS = 1100; // Delay entre requisicoes SEFAZ (rate limit)

// Validar configuracoes
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !WORKER_INGEST_TOKEN || !CERT_MASTER_KEY) {
  console.error('Variaveis de ambiente obrigatorias nao configuradas');
  process.exit(1);
}

// Cliente Supabase
const supabase = new SupabaseWorkerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKER_INGEST_TOKEN);

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
 * Sincroniza uma empresa especifica
 */
async function syncEmpresa(empresaId: string): Promise<{
  success: boolean;
  documentsProcessed: number;
  creditsCreated: number;
  error?: string;
}> {
  console.log(`[SYNC] Iniciando sincronizacao para empresa ${empresaId}`);

  try {
    // Buscar certificado
    const certificate = await supabase.getCertificate(empresaId);
    if (!certificate) {
      throw new Error('Certificado nao encontrado');
    }

    // Buscar estado atual
    let syncState = await supabase.getSyncState(empresaId);
    const ultNSU = syncState?.ult_nsu || 0;

    // Atualizar estado para running
    await supabase.updateSyncState(empresaId, { status: 'running' });

    // Descriptografar certificado
    // NOTA: Em producao real, os dados ja estarao criptografados
    // Aqui assumimos que podem estar em texto plano (para testes)
    let pfxBase64 = certificate.cert_pfx_encrypted;
    let password = certificate.cert_password_encrypted;

    // Tentar descriptografar se parecer base64 criptografado
    try {
      if (CERT_MASTER_KEY && certificate.cert_pfx_encrypted.length > 100) {
        pfxBase64 = decrypt(certificate.cert_pfx_encrypted, CERT_MASTER_KEY);
        password = decrypt(certificate.cert_password_encrypted, CERT_MASTER_KEY);
      }
    } catch {
      // Se falhar, assume que esta em texto plano
      console.log('[SYNC] Usando certificado sem criptografia');
    }

    // Criar cliente SEFAZ
    const sefaz = new SefazClient(pfxBase64, password, certificate.ambiente, certificate.uf);

    let currentNSU = ultNSU;
    let totalDocuments = 0;
    let totalCredits = 0;
    let hasMore = true;
    let maxNSU = 0;

    // Iterar ate nao ter mais documentos
    while (hasMore) {
      await supabase.log(empresaId, 'info', `Consultando NSU ${currentNSU}`);

      const result = await sefaz.consultarDistribuicao(certificate.cnpj, currentNSU);
      
      maxNSU = result.maxNSU;
      hasMore = result.hasMore;

      if (result.documents.length > 0) {
        // Enviar em lotes
        for (let i = 0; i < result.documents.length; i += BATCH_SIZE) {
          const batch = result.documents.slice(i, i + BATCH_SIZE);
          
          try {
            const ingestResult = await supabase.ingestDocuments({
              empresa_id: empresaId,
              documents: batch,
            });

            totalDocuments += ingestResult.inserted;
            totalCredits += ingestResult.credits_created;

            console.log(`[SYNC] Lote processado: ${ingestResult.inserted} docs, ${ingestResult.credits_created} creditos`);
          } catch (error) {
            console.error('[SYNC] Erro no lote:', error);
            await supabase.log(empresaId, 'error', `Erro ao processar lote: ${error}`);
          }
        }
      }

      currentNSU = result.ultNSU;

      // Atualizar estado intermediario
      await supabase.updateSyncState(empresaId, {
        ult_nsu: currentNSU,
        max_nsu: maxNSU,
        documents_fetched: totalDocuments,
        credits_created: totalCredits,
      });

      // Delay para respeitar rate limit
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      }
    }

    // Finalizar
    await supabase.updateSyncState(empresaId, {
      status: 'idle',
      last_sync_at: new Date().toISOString(),
      last_error: null,
      ult_nsu: currentNSU,
      max_nsu: maxNSU,
      documents_fetched: totalDocuments,
      credits_created: totalCredits,
    });

    await supabase.log(empresaId, 'info', `Sincronizacao concluida: ${totalDocuments} docs, ${totalCredits} creditos`);

    return {
      success: true,
      documentsProcessed: totalDocuments,
      creditsCreated: totalCredits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SYNC] Erro: ${message}`);

    await supabase.updateSyncState(empresaId, {
      status: 'error',
      last_error: message,
    });

    await supabase.log(empresaId, 'error', `Erro na sincronizacao: ${message}`);

    return {
      success: false,
      documentsProcessed: 0,
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
      // Delay entre empresas
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
  console.log(`NFe Worker rodando na porta ${PORT}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
});
