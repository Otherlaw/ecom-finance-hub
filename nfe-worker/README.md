# NFe Worker - Sincronizacao Automatica via Distribuicao DF-e

Worker externo Node.js para comunicacao com a SEFAZ usando certificado digital A1.

## Arquitetura

Este worker e necessario porque as Edge Functions do Supabase (Deno) nao suportam mutual TLS com PFX para SOAP da SEFAZ. O worker:

1. Le do Supabase quais empresas devem sincronizar (via Edge Function proxy)
2. Usa certificado A1/PFX para consultar o WS de Distribuicao DF-e
3. Envia XMLs completos para o Supabase via endpoint `nfe-ingest`
4. Atualiza estado e logs (via Edge Function proxy)

**Nota**: O worker NAO precisa de `SUPABASE_SERVICE_ROLE_KEY`. Todas as operacoes de banco sao feitas via Edge Function `nfe-worker-proxy`, autenticada com `WORKER_INGEST_TOKEN`.

## Estrutura de Arquivos

```
nfe-worker/
├── src/
│   ├── index.ts           # Entry point
│   ├── sefaz-client.ts    # Cliente SOAP para SEFAZ
│   ├── supabase-client.ts # Cliente HTTP para Edge Functions
│   ├── crypto.ts          # Criptografia de certificados
│   └── types.ts           # Tipos TypeScript
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Variaveis de Ambiente

```env
# Supabase
SUPABASE_URL=https://bwfbozwyqujlykgaueez.supabase.co

# Seguranca
WORKER_INGEST_TOKEN=your-ingest-token
CERT_MASTER_KEY=your-32-byte-encryption-key

# SEFAZ
SEFAZ_ENV=producao  # ou 'homologacao'
```

| Variavel | Descricao |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `WORKER_INGEST_TOKEN` | Token compartilhado com as Edge Functions |
| `CERT_MASTER_KEY` | Chave para descriptografar certificados A1 |
| `SEFAZ_ENV` | Ambiente SEFAZ: `production` ou `homologation` |

## Deploy

### Render (Recomendado)

1. Criar novo Web Service no Render
2. Conectar repositorio
3. Configurar:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Adicionar variaveis de ambiente (4 variaveis apenas!)
5. Deploy automatico

### Cloud Run (Google Cloud)

```bash
# Build
docker build -t nfe-worker .

# Push para Container Registry
docker tag nfe-worker gcr.io/YOUR_PROJECT/nfe-worker
docker push gcr.io/YOUR_PROJECT/nfe-worker

# Deploy
gcloud run deploy nfe-worker \
  --image gcr.io/YOUR_PROJECT/nfe-worker \
  --platform managed \
  --region us-central1 \
  --set-env-vars SUPABASE_URL=...,WORKER_INGEST_TOKEN=...
```

### Fly.io

```bash
fly launch
fly secrets set SUPABASE_URL=...
fly secrets set WORKER_INGEST_TOKEN=...
fly secrets set CERT_MASTER_KEY=...
fly secrets set SEFAZ_ENV=production
fly deploy
```

## Execucao Local

```bash
# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais

# Executar
npm run dev

# Build para producao
npm run build
npm start
```

## API Endpoints

### POST /sync
Inicia sincronizacao para uma empresa especifica.

```json
{
  "empresa_id": "uuid-da-empresa"
}
```

### POST /sync-all
Sincroniza todas as empresas com certificado ativo.

### GET /health
Health check endpoint.

## Fluxo de Sincronizacao

```
┌──────────────────────┐
│   Render Worker      │
│   (Node.js)          │
├──────────────────────┤
│ POST /sync           │──┬──▶ SEFAZ (mTLS com certificado A1)
│ POST /sync-all       │  │
│ GET  /health         │  │
└──────────────────────┘  │
         │                │
         │ HTTP + token   │ XMLs
         ▼                │
┌──────────────────────┐  │
│ nfe-worker-proxy     │◀─┘ (get-certificate)
│ (Edge Function)      │
├──────────────────────┤
│ get-certificate      │
│ get-sync-state       │
│ update-sync-state    │──▶ Supabase DB
│ log                  │
│ get-active-companies │
└──────────────────────┘

┌──────────────────────┐
│ nfe-ingest           │
│ (Edge Function)      │
├──────────────────────┤
│ Recebe XMLs          │──▶ nfe_documents + creditos_icms
│ Processa créditos    │
└──────────────────────┘
```

1. Worker chama `nfe-worker-proxy?action=get-certificate` para obter certificado
2. Descriptografa PFX e senha usando `CERT_MASTER_KEY`
3. Cria agente HTTPS com certificado para mutual TLS
4. Consulta WS `nfeDistDFeInteresse` da SEFAZ
5. Itera por NSUs ate `maxNSU`
6. Para cada documento:
   - Se `procNFe`: extrai XML completo
   - Envia para `/nfe-ingest` do Supabase
7. Atualiza estado via `nfe-worker-proxy?action=update-sync-state`
8. Registra logs via `nfe-worker-proxy?action=log`

## Seguranca

- **Sem SERVICE_ROLE_KEY**: Worker nao precisa de acesso admin ao Supabase
- Certificados armazenados criptografados (AES-256-GCM)
- Comunicacao autenticada via `WORKER_INGEST_TOKEN`
- Variaveis sensiveis via secrets do provedor cloud

## Monitoramento

- Logs estruturados para Cloud Logging
- Metricas de sincronizacao via `nfe_sync_logs`
- Health check endpoint para uptime monitoring

## Limites SEFAZ

- Maximo 50 documentos por requisicao
- Rate limit: 1 req/segundo
- Backoff exponencial em caso de erro
