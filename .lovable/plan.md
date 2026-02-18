
## Diagnóstico do Bug

### Causa Raiz Confirmada

Existem **duas versões da RPC `get_vendas_por_pedido`** no banco simultaneamente:

| Versão | Parâmetros de paginação | Parâmetros de data | Lógica CMV |
|--------|------------------------|--------------------|------------|
| **V-TEXT** (usada pelo hook) | `p_limit`, `p_offset` | `TEXT` | ❌ Só busca em `sku_costs` — ignora `produtos.custo_medio` |
| **V-DATE** (versão correta) | `p_page`, `p_page_size` | `DATE` | ✅ Busca em `produtos` com fallback `sku_costs` |

O hook `useVendasPorPedido.ts` chama a versão com `p_limit`/`p_offset` (V-TEXT), que tem a CTE `itens_agg` assim:

```sql
-- ERRADO: só verifica sku_costs, nunca produtos.custo_medio
CASE 
  WHEN bool_and(mti.produto_id IS NOT NULL AND sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
  THEN SUM(mti.quantidade * COALESCE(sc.custo_unitario, 0))
  ELSE NULL
END AS cmv_total
```

Como a tabela `sku_costs` está vazia (0 registros), **todos os pedidos retornam `cmv_total = NULL`** e `tem_cmv = false`.

A versão correta (V-DATE) usa:
```sql
-- CORRETO: prioriza produtos.custo_medio, fallback sku_costs
LEFT JOIN produtos p ON p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0
LEFT JOIN sku_costs sc ON sc.sku = mti.sku_marketplace AND sc.empresa_id = mt2.empresa_id

CASE
  WHEN bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0)
  THEN SUM(mti.quantidade * COALESCE(NULLIF(p.custo_medio, 0), NULLIF(sc.custo_unitario, 0)))
  ELSE NULL
END AS cmv_total
```

### Verificação Manual Confirmou
- Pedido `2000011607460473`: produto `FI-DU-FA-MA` com `custo_medio = 4` ✅ existe
- CMV calculado manualmente: `1 × 4 = R$ 4,00` ✅ correto
- CMV retornado pela RPC errada (V-TEXT): `NULL` ❌

---

## Plano de Correção

### Ação 1 — Migração SQL: corrigir a versão TEXT da RPC

Substituir a CTE `itens_agg` da versão com parâmetros `p_limit`/`p_offset` para usar a mesma lógica correta da versão DATE:

```sql
-- Substituir a CTE itens_agg na versão TEXT por:
itens_agg AS (
  SELECT
    COALESCE(mt2.pack_id, mt2.pedido_id) AS grp_pedido_id,
    mt2.empresa_id,
    SUM(mti.quantidade) AS qtd_itens,
    CASE
      WHEN bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0)
      THEN SUM(mti.quantidade * COALESCE(NULLIF(p.custo_medio, 0), NULLIF(sc.custo_unitario, 0)))
      ELSE NULL
    END AS cmv_total,
    bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0) AS tem_cmv,
    (array_agg(DISTINCT mti.anuncio_id ...) ...)[1] AS primeiro_anuncio_id,
    ARRAY(...) AS anuncio_ids
  FROM marketplace_transaction_items mti
  JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
  LEFT JOIN produtos p ON p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0
  LEFT JOIN sku_costs sc ON sc.sku = mti.sku_marketplace AND sc.empresa_id = mt2.empresa_id
  WHERE ...
  GROUP BY COALESCE(mt2.pack_id, mt2.pedido_id), mt2.empresa_id
)
```

Também corrigir o SELECT final para incluir `fonte_custo` e ajustar o cálculo de `valor_liquido_calculado` com imposto e logística.

### Ação 2 — Garantir consistência do retorno

A versão TEXT também precisa retornar `fonte_custo` no resultado (campo presente no tipo `PedidoAgregado` do frontend mas ausente na versão TEXT atual).

### Arquivos afetados

- **Migração SQL** (novo arquivo em `supabase/migrations/`): reescreve a versão TEXT da RPC com a lógica correta de CMV

Nenhum arquivo de frontend precisa mudar — o hook já está correto, o problema é 100% no banco.

### Como testar após a correção

1. Abrir aba Vendas com o período de hoje (18/02/2026)
2. O pedido `...07460473` (FI-DU-FA-MA, custo R$ 4,00) deve aparecer com CMV = R$ 4,00 e margem calculada
3. Outros pedidos com produtos mapeados também devem mostrar CMV corretamente
4. Pedidos sem produto mapeado continuam mostrando "Sem custo" — comportamento esperado
