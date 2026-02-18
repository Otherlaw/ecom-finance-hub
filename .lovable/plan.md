
## Diagnóstico Definitivo: Bug do Frete no Flex

### O que está acontecendo

Para pedidos do Mercado Livre com `tipo_envio = 'flex'`, a API do ML **não retorna** o custo do frete do vendedor no campo `frete_vendedor`. Esse campo fica `NULL` na tabela `marketplace_transactions`.

A RPC `get_vendas_por_pedido` exibe `frete_vendedor_total = NULL` corretamente — o problema está em **como o custo operacional configurado (`logistica_plataforma_config`) deveria ser aplicado**, e atualmente ele **não está sendo aplicado** na RPC principal.

O valor R$9,90 que aparece incorretamente na tela vem da tabela `logistica_plataforma_config` onde:
- Mercado Livre / Flex = **R$10,90** (correto)
- Shopee / Flex = **R$9,90** (incorreto — está sendo mostrado no lugar do ML)

Há um componente ou lógica no frontend que está lendo o custo da configuração sem filtrar pelo canal do pedido.

### Lógica de negócio correta (conforme explicado pelo usuário)

Para um pedido Flex do Mercado Livre:
- Custo operacional pago à empresa de flex: **R$10,90** (configurado)
- Bônus por envio recebido do ML: **R$1,10** (crédito)
- **Frete Vendedor Líquido real = R$10,90 - R$1,10 = R$9,80**

O campo `bonus_envio` nas transações está zerado porque o ML ainda não enviou esse dado como evento separado — ele aparece na tela do Mercado Livre mas não chega via API de forma direta.

### Plano de Correção

#### Ação 1 — Corrigir a RPC `get_vendas_por_pedido`

Adicionar uma CTE `config_logistica_plataforma` que busca o custo configurado por `canal` e `tipo_envio` em `logistica_plataforma_config`. Quando `frete_vendedor` for `NULL` e o pedido for `flex` ou `flex_turbo`, usar o custo configurado **menos** o `bonus_envio`:

```sql
config_logistica_plataforma AS (
  SELECT lpc.empresa_id, lpc.canal, lpc.tipo_envio, lpc.custo
  FROM logistica_plataforma_config lpc
  WHERE lpc.empresa_id = ANY(v_empresa_ids)
),
```

No SELECT final do `resultado`, substituir:
```sql
vb.frete_vendedor_agg AS frete_vendedor_total,
```
Por:
```sql
CASE
  -- Se frete_vendedor veio da API, usar ele
  WHEN vb.frete_vendedor_agg IS NOT NULL THEN vb.frete_vendedor_agg
  -- Se é flex/flex_turbo sem frete_vendedor, aplicar custo configurado menos bonus_envio
  WHEN vb.tipo_envio IN ('flex', 'flex_turbo') THEN
    GREATEST(0, COALESCE(lpc.custo, 0) - COALESCE(vb.bonus_envio_agg, 0))
  ELSE NULL
END AS frete_vendedor_total,
```

O JOIN com `config_logistica_plataforma` filtra por `canal` e `tipo_envio`:
```sql
LEFT JOIN config_logistica_plataforma lpc 
  ON lpc.empresa_id = vb.empresa_id 
  AND lpc.canal = vb.canal 
  AND lpc.tipo_envio = vb.tipo_envio
```

O mesmo ajuste deve ser feito no cálculo do `valor_liquido_calculado` e `margem_contribuicao` para que a dedução seja consistente.

#### Ação 2 — Corrigir a RPC `get_vendas_por_pedido_resumo_v2`

Esta RPC de resumo (usada nos cards de totais) referencia a tabela antiga `empresa_logistica_config` com colunas `flex_custo`/`flex_turbo_custo` — que não filtra por canal. Precisa ser atualizada para usar `logistica_plataforma_config` com filtro por canal.

Atualmente (linha 65-67):
```sql
config_logistica AS (
  SELECT elc.empresa_id, COALESCE(elc.flex_custo, 0) AS flex_custo, COALESCE(elc.flex_turbo_custo, 0) AS flex_turbo_custo
  FROM empresa_logistica_config elc
```

Isso mistura canais sem distinguir ML de Shopee, resultando nos valores incorretos.

#### Resultado esperado após a correção

Para o pedido `2000011604513427` (ML / Flex / R$20,90):
| Campo | Antes | Depois |
|---|---|---|
| `frete_vendedor_total` | NULL | R$9,80 (R$10,90 - R$1,10 de bônus) |
| `valor_liquido_calculado` | R$9,22 | R$9,22 - R$9,80 = valor correto |
| `margem_contribuicao` | calculado sem frete | calculado com frete flex |

### Arquivos Afetados

- **Migração SQL** (1 novo arquivo): corrige as RPCs `get_vendas_por_pedido` e `get_vendas_por_pedido_resumo_v2` para usar `logistica_plataforma_config` com filtro por canal e tipo de envio, aplicando o custo operacional quando `frete_vendedor` for NULL em pedidos flex.

Nenhum arquivo de frontend precisa ser alterado.

### Como Testar

1. Abrir aba Vendas e filtrar por **Tipo de Envio = Flex**
2. Pedido `...4513427` (R$20,90 ML Flex) deve mostrar:
   - Frete Vendedor = R$9,80 (R$10,90 - R$1,10)
   - Margem corretamente deduzida
3. Pedidos Flex com `frete_vendedor` já preenchido pela API (ex: R$24,95) devem continuar exibindo esse valor sem alteração
4. Pedidos Full e Coleta não devem ser afetados
