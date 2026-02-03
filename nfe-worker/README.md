# NFe Worker - Sincronizacao Automatica via Distribuicao DF-e

Worker externo Node.js para comunicacao com a SEFAZ usando certificado digital A1.

## Arquitetura

Este worker e necessario porque as Edge Functions do Supabase (Deno) nao suportam mutual TLS com PFX para SOAP da SEFAZ. O worker:

1. Le do Supabase quais empresas devem sincronizar
2. Usa certificado A1/PFX para consultar o WS de Distribuicao DF-e
3. Envia XMLs completos para o Supabase via endpoint `nfe-ingest`
4. Atualiza estado e logs

## Estrutura de Arquivos

```
nfe-worker/
├── src/
│   ├── index.ts           # Entry point
│   ├── sefaz-client.ts    # Cliente SOAP para SEFAZ
│   ├── supabase-client.ts # Cliente Supabase
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
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Seguranca
WORKER_INGEST_TOKEN=your-ingest-token
CERT_MASTER_KEY=your-32-byte-encryption-key

# SEFAZ
SEFAZ_ENV=producao  # ou 'homologacao'

# Sync
SYNC_INTERVAL_MINUTES=30
```

## Deploy

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
  --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...
```

### Fly.io

```bash
fly launch
fly secrets set SUPABASE_URL=...
fly secrets set SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

### Render

1. Criar novo Web Service
2. Conectar repositorio
3. Configurar variaveis de ambiente
4. Deploy automatico

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

1. Busca `nfe_certificates` e `nfe_sync_state` do Supabase
2. Descriptografa PFX e senha usando `CERT_MASTER_KEY`
3. Cria agente HTTPS com certificado para mutual TLS
4. Consulta WS `nfeDistDFeInteresse` da SEFAZ
5. Itera por NSUs ate `maxNSU`
6. Para cada documento:
   - Se `procNFe`: extrai XML completo
   - Envia para `/nfe-ingest` do Supabase
7. Atualiza `ult_nsu` e `last_sync_at`
8. Registra logs

## Seguranca

- Certificados armazenados criptografados (AES-256-GCM)
- Comunicacao autenticada com Supabase (service role)
- Token de autenticacao para endpoint de ingestao
- Variaveis sensiveis via secrets do provedor cloud

## Monitoramento

- Logs estruturados para Cloud Logging
- Metricas de sincronizacao via `nfe_sync_logs`
- Health check endpoint para uptime monitoring

## Limites SEFAZ

- Maximo 50 documentos por requisicao
- Rate limit: 1 req/segundo
- Backoff exponencial em caso de erro
