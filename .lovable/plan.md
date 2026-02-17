

# Corrigir logica de cutoff e primeira sync do nfe-worker

## Problemas identificados

1. **Primeira sync descarta todos os documentos**: `computeCutoffDate` retorna `null` quando `first_success_at` nao existe. O ingest recebe `cutoff_date: undefined` (via `currentCutoff || undefined`) e ignora tudo.

2. **Cutoff fixo em `first_success_at - 24h`**: Em syncs futuras, se o worker ficou parado 2+ dias, NFs emitidas nesse intervalo sao descartadas porque o cutoff e relativo ao `first_success_at` e nao ao `last_sync_at`.

3. **Comentarios enganosos**: Linhas 276-278 dizem explicitamente "nao importamos nada na primeira rodada", reforçando o bug.

---

## Alteracoes

### 1. sync-utils.ts -- `computeCutoffDate` nunca retorna null

Mudar a funcao para que, quando `firstSuccessAt` for null (primeira sync), retorne "ontem" como cutoff. Isso permite importar NFs recentes sem trazer historico longo.

```text
export function computeCutoffDate(firstSuccessAt: string | null | undefined): string {
  if (!firstSuccessAt) {
    // Primeira sync: usar ontem como cutoff (pega NFs recentes)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    return yesterday.toISOString().split('T')[0];
  }
  const date = new Date(firstSuccessAt);
  date.setHours(date.getHours() - 24);
  return date.toISOString().split('T')[0];
}
```

Retorno muda de `string | null` para `string`.

### 2. index.ts -- 3 correcoes pontuais

**a) Linha 185**: Mudar mensagem de log de "NSU avancara sem importar documentos antigos" para "Primeira sincronizacao. Importando documentos recentes (cutoff: ontem)."

**b) Linhas 276-278**: Remover os 3 comentarios enganosos que dizem "nao importamos nada na primeira rodada".

**c) Linha 322**: Mudar `cutoff_date: currentCutoff || undefined` para `cutoff_date: currentCutoff`. Como `computeCutoffDate` nunca retorna null, o `|| undefined` nao e mais necessario e era a causa de transformar string vazia/null em undefined.

---

## Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `nfe-worker/src/sync-utils.ts` | `computeCutoffDate` retorna `string` (nunca null), usa "ontem" quando sem `firstSuccessAt` |
| `nfe-worker/src/index.ts` | Corrigir log (L185), remover comentarios enganosos (L276-278), remover `\|\| undefined` (L322) |

## Impacto

- Primeira sync: documentos recentes (ultimas 24h) serao importados em vez de descartados
- Syncs futuras: cutoff continua sendo `first_success_at - 24h` (sem mudanca)
- NSU continua avancando sempre (sem mudanca)
- Nenhum outro arquivo e alterado

## Como testar

1. Rebuild e deploy no Render
2. Resetar `first_success_at` e `ult_nsu` para NULL/0 na tabela `nfe_sync_state` (se quiser simular primeira sync)
3. Disparar sync -- logs devem mostrar "Importando documentos recentes" e documentos importados > 0
4. Verificar que NFs recentes aparecem na aba ICMS

