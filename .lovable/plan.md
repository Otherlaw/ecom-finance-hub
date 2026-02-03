
# Plano: Remover dependência do SUPABASE_SERVICE_ROLE_KEY no Worker

## Problema Identificado
O worker externo no Render precisa de `SUPABASE_SERVICE_ROLE_KEY` para acessar as tabelas `nfe_certificates`, `nfe_sync_state` e `nfe_sync_logs`. Porém, essa chave não está disponível na interface do Lovable Cloud.

## Solução Proposta
Criar uma Edge Function `nfe-worker-proxy` que funciona como API intermediária, permitindo que o worker faça todas as operações de banco via HTTP autenticado com `WORKER_INGEST_TOKEN` (que já está configurado).

---

## Mudanças Técnicas

### 1. Nova Edge Function: `nfe-worker-proxy`

```
supabase/functions/nfe-worker-proxy/index.ts
```

Endpoints suportados (via query param `action`):

| Action | Descrição | Dados Retornados |
|--------|-----------|------------------|
| `get-certificate` | Busca certificado A1 ativo | PFX, senha, CNPJ, UF, ambiente |
| `get-sync-state` | Retorna estado de sincronização | ult_nsu, status |
| `update-sync-state` | Atualiza estado | - |
| `log` | Registra log em nfe_sync_logs | - |
| `get-active-companies` | Lista empresas com certificado ativo | Array de empresa_id |

Autenticação: Header `x-worker-token` = `WORKER_INGEST_TOKEN`

### 2. Atualização do Worker: `nfe-worker/src/supabase-client.ts`

Substituir uso do SDK Supabase por chamadas HTTP à Edge Function:

```typescript
// ANTES
const { data, error } = await this.client
  .from('nfe_certificates')
  .select('*')
  .eq('empresa_id', empresaId);

// DEPOIS
const response = await fetch(
  `${this.supabaseUrl}/functions/v1/nfe-worker-proxy?action=get-certificate&empresa_id=${empresaId}`,
  {
    headers: { 'x-worker-token': this.ingestToken }
  }
);
```

### 3. Atualização do Worker: `nfe-worker/src/index.ts`

- Remover validação de `SUPABASE_SERVICE_ROLE_KEY`
- Ajustar instanciação do `SupabaseWorkerClient` (remover parâmetro serviceRoleKey)

### 4. Atualização da documentação: `.env.example`

- Remover `SUPABASE_SERVICE_ROLE_KEY` da lista de variáveis obrigatórias

---

## Diagrama de Arquitetura

```text
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

---

## Variáveis de Ambiente (Render)

**Antes (5 variáveis):**
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (não disponível)
- ✅ `SUPABASE_URL`
- ✅ `WORKER_INGEST_TOKEN`
- ✅ `CERT_MASTER_KEY`
- ✅ `SEFAZ_ENV`

**Depois (4 variáveis):**
- ✅ `SUPABASE_URL` - já configurada
- ✅ `WORKER_INGEST_TOKEN` - já configurada
- ✅ `CERT_MASTER_KEY` - já configurada
- ✅ `SEFAZ_ENV` - já configurada

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/nfe-worker-proxy/index.ts` | **Criar** |
| `nfe-worker/src/supabase-client.ts` | **Modificar** |
| `nfe-worker/src/index.ts` | **Modificar** |
| `nfe-worker/.env.example` | **Modificar** |
| `nfe-worker/README.md` | **Modificar** |

---

## Benefícios

1. **Elimina bloqueio**: Não precisa mais de acesso à service key
2. **Segurança**: Certificados e credenciais nunca saem do ambiente Supabase
3. **Simplicidade**: Worker só precisa de 4 variáveis de ambiente
4. **Consistência**: Toda autenticação usa o mesmo token (`WORKER_INGEST_TOKEN`)

---

## Passos para Testar

Após implementação:
1. Fazer deploy no Render (não precisa adicionar novas variáveis)
2. Verificar se `/health` retorna 200
3. Disparar sincronização pelo dashboard
4. Checar logs no Render e em `nfe_sync_logs`
