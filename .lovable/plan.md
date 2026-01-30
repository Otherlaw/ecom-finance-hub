
## O que está acontecendo (por que “antes funcionava” e agora não)

Pelo que eu vi no código e nas chamadas de rede:

1) **O card “CMV / Custos” do Dashboard não usa a RPC do Top 10.**  
   Ele vem da RPC **`get_dashboard_kpis_period`** (hook `useDashboardKPIs`).  
   Essa RPC calcula CMV assim:

- `marketplace_transaction_items` → **JOIN apenas por `produto_id`** → `produtos.custo_medio`

Hoje, muitos itens estão **sem `produto_id` preenchido** (ou com `produto_id` apontando para um produto sem custo), mas **têm SKU**. Resultado: o CMV total do período fica **0**, e o card fica **R$ 0,00**.

2) **O Top 10 está carregando e aparecendo, mas o “CMV” dele depende do `custo_unitario` da RPC `get_top_produtos_vendidos`.**  
   A RPC já tem fallback por SKU, mas o fallback atual só acontece quando `mti.produto_id IS NULL`. Se `produto_id` existe porém:
   - o produto vinculado não tem `custo_medio`, ou
   - o custo está no produto encontrado por SKU e não no produto por ID,  
   então a linha pode continuar com custo 0.

Ou seja: você tem **duas fontes diferentes** calculando “CMV”:
- **CMV do Dashboard (KPIs)**: vem de `get_dashboard_kpis_period` e está “preso” no `produto_id`.
- **CMV do Top 10**: vem de `get_top_produtos_vendidos` e precisa de fallback mais robusto (não só quando `produto_id` é null).

Isso explica “nada mudou” do seu ponto de vista: o Top 10 pode até estar vindo, mas **o CMV geral do dashboard (card) continua zerado**, e no Top 10 o custo pode continuar 0 dependendo do caso.

---

## Objetivo do ajuste (o que vai “voltar a funcionar”)

1) **CMV do Dashboard (card) deixar de ser 0**, calculando CMV com a mesma lógica do Top 10:
- Prioriza `produto_id` quando houver custo válido
- Fallback por `sku_marketplace` quando `produto_id` estiver ausente **ou** quando o produto por ID não tiver custo válido
- (Opcional, mas recomendado) fallback final via `sku_costs` (caso exista e esteja no projeto) para cobrir SKUs ainda não mapeados

2) **Top 10 exibir CMV/lucro/margem com custo correto**, usando o mesmo critério de fallback acima.

3) Manter **visão consolidada (todas as empresas)** e **individual por empresa** (isso já está implementado no Dashboard.tsx e na WHERE clause da RPC do Top 10, mas vamos preservar e validar).

---

## Implementação proposta (mudanças concretas)

### Parte A — Corrigir CMV do Dashboard (KPIs) na RPC `get_dashboard_kpis_period`

**Arquivo alvo:** migration nova em `supabase/migrations/*_update_get_dashboard_kpis_period_cmv_fallback.sql`

No CTE `cmv_periodo`, trocar:

```sql
LEFT JOIN produtos p ON p.id = mti.produto_id
```

por uma resolução de custo com fallback (mesmo padrão do Top 10), algo como:

- `p_by_id`: join por `produto_id`
- `p_by_sku`: join por `sku_marketplace` + `empresa_id`
- (opcional) `sku_costs`: join por sku + empresa_id (e possivelmente canal)

E então calcular:

- `custo_resolvido := COALESCE(NULLIF(p_by_id.custo_medio,0), NULLIF(p_by_sku.custo_medio,0), NULLIF(sc.custo_unitario,0), 0)`
- `cmv_total := SUM(mti.quantidade * custo_resolvido)`
- `itens_com_custo`: contar itens em que `custo_resolvido > 0`
- `total_itens`: manter

**Importante:** manter o filtro consolidado:
```sql
AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
```

**Impacto esperado:**
- O card “CMV / Custos” passa a mostrar valor real
- As margens do dashboard deixam de ser infladas por CMV=0

---

### Parte B — Corrigir custo no Top 10 quando `produto_id` existe mas custo não existe

**Arquivo alvo:** migration nova em `supabase/migrations/*_update_get_top_produtos_vendidos_cost_resolution.sql`

Hoje a RPC do Top 10 tem:
- `p_by_sku` só quando `mti.produto_id IS NULL`

Vamos ajustar para o fallback acontecer também quando o custo do `p_by_id` é nulo/zero. Duas abordagens possíveis (vou implementar a mais segura):

**Abordagem recomendada:**
- Manter `p_by_sku` sempre que houver `mti.sku_marketplace` (com o filtro `empresa_id = mt.empresa_id`)
- Resolver custo com:
  ```sql
  COALESCE(NULLIF(p_by_id.custo_medio,0), NULLIF(p_by_sku.custo_medio,0), 0)
  ```

Assim, mesmo se `produto_id` estiver preenchido mas o custo estiver zerado no produto por ID, o SKU “salva” o custo.

**Bônus (robustez):** se existir `sku_costs`, aplicar o mesmo fallback final também no Top 10:
```sql
COALESCE(NULLIF(p_by_id.custo_medio,0), NULLIF(p_by_sku.custo_medio,0), NULLIF(sc.custo_unitario,0), 0)
```

---

### Parte C — Validar que a visão consolidada e por empresa está correta

**Front-end (Dashboard.tsx) já está OK** para:
- `p_empresa_id: empresaIdFiltro || null`
- `enabled: !!periodoInicio && !!periodoFim`

O que vamos fazer aqui é **validar e ajustar mensagens/indicadores** (se necessário), mas a parte funcional já está no lugar.

---

## Sequência de execução (para não ficar “parece que não mudou”)

1) **Criar migration** atualizando `get_dashboard_kpis_period` (isso destrava o CMV do card)
2) **Criar migration** atualizando `get_top_produtos_vendidos` (isso destrava CMV/lucro/margem do Top 10)
3) Recarregar o Dashboard e verificar:
   - Card “CMV / Custos” > 0 no período com vendas
   - Top 10 com itens apresentando custo (pelo menos nos SKUs que têm custo cadastrado)
4) Se ainda houver itens sem custo:
   - Exibir/confirmar completude (ex.: “X de Y itens com custo”), para não mascarar problema de cadastro/mapeamento

---

## Critérios de aceite (como você vai testar)

No **Preview**, na rota `/` (Dashboard):

1) Período 7 dias (ou um período conhecido com vendas)
2) “Todas as empresas”:
   - Card “CMV / Custos” deixa de ser R$ 0,00
   - Top 10 mostra alguns itens com lucro/margem menores (porque CMV agora entra)
3) Selecionar uma empresa específica:
   - Top 10 muda (valores diferentes do consolidado)
   - CMV do card muda (coerente com a empresa)

---

## Riscos / pontos de atenção

- **Se o custo estiver cadastrado em outro lugar (ex.: tabela `sku_costs`) e não em `produtos.custo_medio`,** o fallback precisa incluir essa tabela, senão continuará zerado para SKUs não mapeados para produto.
- **Não vou mexer em `src/integrations/supabase/types.ts`** (ele é gerado automaticamente). Se ele foi alterado no histórico, a correção ideal é parar de tocar nele e deixar o build regerar quando necessário.
- A query `por_canal` do Top 10 hoje não soma corretamente quantidades por canal (aparece “1” em vez do total). Não bloqueia CMV, mas posso corrigir junto se você quiser.

---

## Entregáveis (o que vai ser modificado)

1) `supabase/migrations/*_update_get_dashboard_kpis_period_cmv_fallback.sql`  
   - Atualiza cálculo do CMV com fallback por SKU (e possivelmente `sku_costs`)

2) `supabase/migrations/*_update_get_top_produtos_vendidos_cost_resolution.sql`  
   - Ajusta fallback de custo mesmo quando `produto_id` existe mas custo é zero/nulo

(Provavelmente **nenhuma mudança** adicional no `Dashboard.tsx` para o CMV; ele já está consumindo as RPCs corretamente.)

---

## Se você quiser “voltar ao que estava antes”
Se “antes funcionava perfeitamente”, o mais rápido para comparar é abrir o histórico e comparar:
- a versão da RPC `get_dashboard_kpis_period` (antes vs agora)
- e de onde vinha o CMV (provavelmente outra fonte / outra forma de mapeamento)

Link de apoio (para quando parece que “nada mudou” após várias tentativas):
https://docs.lovable.dev/tips-tricks/troubleshooting
