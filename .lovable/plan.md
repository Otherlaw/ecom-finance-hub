
## Causa Raiz Identificada: 2.548 pedidos Flex classificados como Coleta

### O que foi descoberto

O ML usa `logistic_type = "self_service"` para **três** cenários distintos, não dois como identificado anteriormente:

| # | Cenário | sender_cost | receiver discount | Total no banco | Classificação atual | Correta |
|---|---|---|---|---|---|---|
| 1 | Coleta Flex pago pelo vendedor | > 0 (ex: R$9,90) | `ratio` (ML divide parte) | 275 | ✅ flex | flex |
| 2 | **Coleta Flex 100% subsidiado ML** | **= 0** | **`loyal` (ML banca tudo)** | **2.548** | **❌ coleta** | **flex** |
| 3 | Coleta real (comprador paga) | = 0 | nenhum / receiver_cost > 0 | 38 | ✅ coleta | coleta |

O pedido `#5388925` é do cenário 2: o ML bancou 100% do frete via programa Loyal/Pontos — o envio É via ponto Coleta Flex parceiro, mas o vendedor não pagou nada. A `resolveLogisticType()` atual só detecta o cenário 1 (quando `sender_cost > 0`), deixando 2.548 pedidos errados.

### Por que o frete do vendedor = R$0 para esses pedidos?

Quando o ML subsidia 100% (`type: "loyal"`):
- `sender_cost = 0` — vendedor não desembolsa nada
- `receiver_discount = {type: "loyal", rate: 1, promoted_amount: 11}` — comprador recebe desconto total
- O envio fisicamente acontece via ponto parceiro Coleta Flex (não Correios/agência)

Resultado financeiro: `frete_vendedor = 0` (correto — o vendedor não paga). O problema é **apenas a classificação visual do tipo de envio**.

### O Que Será Feito

**1. Corrigir `resolveLogisticType()` no edge function `ml-sync-orders`**

Adicionar detecção do cenário 2 (discount `loyal` ou `ratio` no receiver indica Coleta Flex, mesmo com `sender_cost=0`):

```typescript
function resolveLogisticType(rawLogisticType: string, shippingCosts: any): string {
  const base = logisticTypeMap[rawLogisticType] || rawLogisticType || "coleta";

  if (rawLogisticType === "self_service") {
    // Cenário 1: vendedor pagou parte → Coleta Flex
    if ((shippingCosts?.sender_cost ?? 0) > 0) return "flex";

    // Cenário 2: ML subsidiou 100% via programa Loyal/Pontos → também é Coleta Flex
    const receiverDiscounts: any[] = shippingCosts?.raw_receiver?.discounts ?? [];
    const hasFlexSubsidy = receiverDiscounts.some(
      (d: any) => d.type === "loyal" || d.type === "ratio"
    );
    if (hasFlexSubsidy) return "flex";
  }

  return base;
}
```

**2. Migration SQL para corrigir os 2.548 registros existentes**

```sql
UPDATE marketplace_transactions
SET
  tipo_envio = 'flex',
  atualizado_em = now()
WHERE
  tipo_envio = 'coleta'
  AND tipo_transacao = 'venda'
  AND (raw_shipping_costs->>'logistic_type') = 'self_service'
  AND (
    raw_shipping_costs->'raw_receiver'->'discounts'->0->>'type' IN ('loyal', 'ratio')
  );
-- Afeta ~2.550 registros (os 275 já corretos continuam intactos)
```

**3. Impacto financeiro (frete_vendedor)**

Para pedidos do cenário 2 (subsidiados 100%):
- `frete_vendedor` permanece `NULL`/`0` — correto, o vendedor não pagou
- `bonus_envio` permanece `0` — correto, não houve save nos raw_senders
- A correção é **apenas no campo `tipo_envio`** (classificação visual)

Para pedidos do cenário 1 (já corretos):
- Nenhuma alteração

**4. Nenhuma alteração na RPC `get_vendas_por_pedido`**

A lógica de frete já trata corretamente:
- `tipo_envio = 'flex'` com `sender_cost = 0` → usa `custo_config - bonus_envio` → resultado = `10,90 - 0 = R$10,90`

Aguarda — isso está correto? Para os 2.548 pedidos onde o ML bancou tudo, o frete_vendedor real = R$0 (vendedor não pagou). Se classificarmos como `flex`, a RPC vai aplicar `custo_logistica_config = R$10,90` como custo, o que seria **errado**.

**Ajuste necessário na RPC também:** Para pedidos `flex` onde `sender_cost = 0` E não há `raw_senders.save > 0` (bonus), o frete efetivo deve ser `0` (não o custo configurado).

```sql
CASE
  WHEN pb.tipo_envio IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api > 0 THEN
    -- Vendedor pagou frete: aplica custo_config - bonus
    GREATEST(0, COALESCE(l.custo, 0) - pb.bonus_envio_agg)
  WHEN pb.tipo_envio IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api = 0 
    AND pb.bonus_envio_agg = 0 THEN
    -- Flex 100% subsidiado pelo ML: vendedor não pagou nada
    0
  WHEN pb.bonus_envio_agg > 0 THEN
    GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
  ELSE pb.frete_vendedor_api
END AS frete_vendedor_total
```

### Arquivos Alterados

1. `supabase/functions/ml-sync-orders/index.ts` — `resolveLogisticType()` expandida (3 linhas novas)
2. Migration SQL nova — corrige 2.548 registros históricos de `coleta` → `flex`
3. Migration SQL nova — atualiza a RPC `get_vendas_por_pedido` com lógica de frete corrigida

### Como Testar

1. Vendas → pedido `#2000011605388925` deve aparecer como **Flex** (não Coleta)
2. Frete Vendedor desse pedido deve ser **R$0,00** (ML bancou tudo)
3. Pedidos genuinamente Coleta (38 registros com comprador pagando) devem continuar como **Coleta**
4. Pedidos Flex com vendedor pagando (cenário 1, 275 registros) devem continuar como **Flex** com frete ≈ R$8,80–R$9,90
5. Nova sincronização via "Reprocessar" deve classificar corretamente pedidos futuros
