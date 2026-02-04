

# Correção da Sincronização NF-e: 3 Pontos Críticos

## Resumo do Problema

A sincronização está travando porque, quando ocorre erro 656, o sistema pode deixar o status como "running" e não persiste o NSU de forma adequada. Existem 3 correções necessárias:

---

## A) Erro 656 não pode deixar status "running"

**Situação atual:** O tratamento do erro 656 no worker (linhas 319-349 de `index.ts`) já seta `status: 'rate_limited'`, porém há um problema: se ocorrer uma exceção durante a atualização do estado, o status permanece "running".

**Correção:**
1. Usar `try/catch` ao redor de todo o tratamento do 656 para garantir que o status NUNCA fique "running" após erro
2. Garantir que a primeira ação ao detectar 656 seja atualizar para `status: 'error'` (não `rate_limited`) imediatamente, e só depois adicionar `next_retry_at`
3. Sair da função imediatamente após o tratamento, sem continuar o loop

---

## B) Bloqueio real antes de chamar SEFAZ

**Situação atual:** O bloqueio existe no worker (linhas 143-187) e também na Edge Function `nfe-sync-request` (linhas 179-224), mas há uma lacuna: o worker pode começar a consultar a SEFAZ antes de verificar corretamente o `next_retry_at`.

**Correção:**
1. Mover a verificação de `next_retry_at` para ANTES de atualizar o estado para "running" no worker
2. Retornar erro claro e específico quando ainda está em cooldown (429 com horário de quando pode tentar)
3. Na Edge Function, garantir que o retorno inclui o tempo restante formatado

**Código afetado:**
- `nfe-worker/src/index.ts` - Verificação de bloqueio deve vir antes do `updateSyncState({ status: 'running' })`
- `supabase/functions/nfe-sync-request/index.ts` - Já está correto, mas precisa de log adicional

---

## C) Persistir NSU CEDO (antes do ingest)

**Situação atual:** O NSU é atualizado após processar todos os lotes do batch (linha 305-310). Se o ingest falhar, o NSU não é salvo e a próxima execução pode recomeçar do zero.

**Correção:**
1. Imediatamente após receber resposta da SEFAZ com `ultNSU`, PERSISTIR no estado antes de chamar o ingest
2. Isso garante que mesmo se o ingest falhar, o NSU avança e não volta ao 0
3. Manter a atualização completa (com contadores) após o ingest como está

**Fluxo corrigido:**
```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Consultar SEFAZ (NSU atual)                                     │
│  2. Receber resposta com ultNSU e docs                              │
│  3. ★ PERSISTIR ultNSU IMEDIATAMENTE (antes do ingest)              │
│  4. Processar ingest (enviar docs para Supabase)                    │
│  5. Atualizar contadores (documents_fetched, credits_created)       │
│  6. Delay 3s e repetir                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos que serão modificados

| Arquivo | Alteração |
|---------|-----------|
| `nfe-worker/src/index.ts` | Reordenar verificação de bloqueio, persistir NSU cedo, ajustar tratamento 656 |
| `supabase/functions/nfe-sync-request/index.ts` | Adicionar log extra e melhorar mensagem de erro |

---

## Detalhes técnicos

### Worker - `nfe-worker/src/index.ts`

**1. Persistir NSU imediatamente após resposta SEFAZ:**
```typescript
// IMEDIATAMENTE após receber resposta da SEFAZ
const result = await sefaz.consultarDistribuicao(cnpj, currentNSU);

// ★ PERSISTIR NSU CEDO - antes de qualquer processamento
currentNSU = result.ultNSU;
maxNSU = result.maxNSU;
hasMore = result.hasMore;

await supabase.updateSyncState(empresaId, {
  ult_nsu: currentNSU,
  max_nsu: maxNSU,
});

// Agora processar documentos...
```

**2. Tratamento do erro 656 - garantir status `error`:**
```typescript
if (isSefazError656(error)) {
  const nextRetryAt = getNextRetryAt();
  
  // ★ Primeiro: status = error, NÃO rate_limited
  // ★ Segundo: adiciona next_retry_at  
  await supabase.updateSyncState(empresaId, {
    status: 'error',  // ← era 'rate_limited', agora é 'error'
    last_error: 'Erro SEFAZ 656: Consumo Indevido. Aguarde 1 hora.',
    ult_nsu: currentNSU,  // Preservar NSU
    max_nsu: maxNSU,
    next_retry_at: nextRetryAt,
  });

  // Sair imediatamente
  return { ... };
}
```

**3. Verificação de bloqueio ANTES de setar running:**
```typescript
// ORDEM CORRETA:
// 1) Verificar se rate_limited + cooldown ativo → retornar erro
// 2) Verificar se running + < 30min → retornar erro
// 3) Só depois: setar status = running
```

---

## Resultados esperados

- **Erro 656:** Status vai para `error` (não `running`), com `next_retry_at` preenchido
- **Concorrência:** Sync manual/cron não rodam em paralelo; bloqueio é verificado ANTES de chamar SEFAZ
- **NSU nunca volta ao 0:** Persistência imediata após resposta SEFAZ, mesmo se ingest falhar
- **UI não trava:** Botão mostra claramente quando pode tentar novamente

---

## Próximos passos após aprovação

1. Implementar as correções nos 2 arquivos
2. Deploy das Edge Functions (automático)
3. **Fazer novo deploy no Render** para o worker
4. Testar sincronização

