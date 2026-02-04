

# Diagnóstico: Sincronização NF-e Travando sem Trazer Notas

## Problema Identificado

A sincronização está travando com status "running" e `ult_nsu = 0`, sem retornar nenhum documento. Analisando os logs:

| Data/Hora | Log | Problema |
|-----------|-----|----------|
| 04/02 05:19 | "Worker respondeu com sucesso" | Worker respondeu HTTP 200 |
| 04/02 05:19 | "Sincronização já em andamento (0 min)" | Lock acionou na segunda tentativa |
| 03/02 08:09 | **"unable to get local issuer certificate"** | Erro SSL crítico |
| --- | Sem logs de "Consultando NSU 0" | **Worker parou antes de consultar SEFAZ** |

---

## Causa Raiz

O worker no Render **não foi atualizado com o código mais recente** que inclui:
1. Correções de SSL (bundle ICP-Brasil)
2. Tratamento robusto do erro 656
3. Persistência precoce do NSU

O erro acontece **silenciosamente** no background porque:
- O endpoint `/sync` responde imediatamente (assíncrono)
- O erro vai para `console.error` no Render, **não para os logs do Supabase**
- O status fica "running" eternamente porque o código não consegue nem começar o processamento

---

## Evidências nos Logs

```text
Fluxo esperado:              Fluxo atual:
─────────────────            ─────────────
1. Sync iniciado            1. Sync iniciado ✓
2. Buscar certificado       2. Buscar certificado ✓
3. Buscar sync state        3. Buscar sync state ✓
4. Log "Iniciando..."       4. ❌ (nunca aparece)
5. Setar status=running     5. ❌ (já setou antes)
6. Log "Consultando NSU"    6. ❌ (nunca chega aqui)
```

---

## Correções Necessárias

### 1. Melhorar Tratamento de Erros no Worker (nfe-worker/src/index.ts)

Adicionar `try/catch` logo no início do `syncEmpresa` para capturar erros de certificado/SSL e registrá-los no Supabase:

```typescript
async function syncEmpresa(empresaId: string) {
  // Registrar início ANTES de qualquer processamento
  try {
    await supabase.log(empresaId, 'info', 'Iniciando processamento...');
  } catch {
    console.error('[SYNC] Erro ao registrar log inicial');
  }

  try {
    const certificate = await supabase.getCertificate(empresaId);
    // ... resto do código
  } catch (error) {
    // ★ CAPTURAR e REGISTRAR erro antes de falhar silenciosamente
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SYNC] Erro fatal: ${message}`);
    
    try {
      await supabase.log(empresaId, 'error', `Erro fatal: ${message}`);
      await supabase.updateSyncState(empresaId, {
        status: 'error',
        last_error: message,
      });
    } catch {
      console.error('[SYNC] Falha ao registrar erro no Supabase');
    }
    
    return { success: false, error: message, ... };
  }
}
```

### 2. Adicionar Log Inicial Antes do Try/Catch Principal

Para garantir que saibamos quando o worker recebeu a requisição:

```typescript
app.post('/sync', async (req, res) => {
  const { empresa_id } = req.body;
  
  // Log imediato para confirmar recebimento
  console.log(`[SYNC] Recebido request para empresa ${empresa_id}`);
  
  // Executar em background MAS com tratamento de erro visível
  syncEmpresa(empresa_id).catch(async (err) => {
    console.error('[SYNC] Erro não tratado:', err);
    // Tentar registrar no Supabase mesmo em caso de erro fatal
    try {
      await supabase.log(empresa_id, 'error', `Erro fatal não tratado: ${err.message}`);
      await supabase.updateSyncState(empresa_id, {
        status: 'error',
        last_error: `Erro fatal: ${err.message}`,
      });
    } catch {
      console.error('[SYNC] Não foi possível registrar erro no Supabase');
    }
  });
  
  res.json({ message: 'Sincronizacao iniciada', empresa_id });
});
```

### 3. Verificar/Atualizar Configuração do Render

Confirmar que as variáveis de ambiente estão corretas:

| Variável | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://bwfbozwyqujlykgaueez.supabase.co` |
| `WORKER_INGEST_TOKEN` | (deve corresponder ao secret no Supabase) |
| `CERT_MASTER_KEY` | (chave de 32 bytes para descriptografar certificados) |
| `NODE_EXTRA_CA_CERTS` | `/opt/render/project/src/nfe-worker/certs/icp-brasil.pem` |

### 4. Forçar Novo Deploy no Render

Após as correções, é necessário:
1. Fazer commit das alterações no repositório
2. Trigger de novo deploy no Render (manual ou automático)
3. Verificar logs do build no Render para confirmar que `certs/` foi copiado

---

## Mudanças Específicas

| Arquivo | Alteração |
|---------|-----------|
| `nfe-worker/src/index.ts` | Adicionar log inicial antes do try/catch, melhorar captura de erros no endpoint `/sync` |
| Render Dashboard | Verificar variáveis de ambiente, especialmente `NODE_EXTRA_CA_CERTS` |

---

## Resultado Esperado

Após as correções:
- Logs de erro aparecerão no Supabase mesmo quando o worker falhar cedo
- Status não ficará "running" eternamente - será atualizado para "error"
- Mensagem de erro será específica (SSL, certificado, timeout, etc.)
- Usuário saberá exatamente o que está falhando

---

## Ação Imediata para Desbloquear

Enquanto as correções não são implementadas, você pode **resetar o status manualmente** para permitir novas tentativas:

```sql
UPDATE nfe_sync_state 
SET status = 'idle', last_error = 'Reset manual', updated_at = NOW()
WHERE empresa_id = 'd2e99a0f-47ae-4490-ac98-0b2cce7047ac';
```
