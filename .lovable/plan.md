

# Plano: Integração de CMV com Tabela de Mapeamento MLB SKU

## Resumo Executivo

O cálculo de CMV na tela de Vendas não está utilizando a tabela `produto_marketplace_map`, que é a tabela correta de mapeamento entre SKUs do marketplace e produtos internos. Isso faz com que 13.272 itens (43% do total) que já têm mapeamento criado fiquem sem CMV calculado.

---

## Diagnóstico

**Dados reais do banco:**

| Situação | Quantidade | Percentual |
|----------|-----------|------------|
| Itens com `produto_id` direto | 14.744 | 47,8% |
| Itens com mapeamento em `produto_marketplace_map` (sem `produto_id` no item) | 13.272 | 43% |
| Itens sem nenhum mapeamento | 2.826 | 9,2% |
| SKUs únicos sem mapeamento | 157 | - |

**Problema principal:**
A RPC `get_vendas_por_pedido` faz fallback para `produtos.sku = sku_marketplace`, ignorando completamente a tabela `produto_marketplace_map`. Isso é incorreto pois:
- A tabela de mapeamento pode ter SKUs diferentes entre marketplace e interno (4 casos confirmados)
- 13.272 itens já mapeados não estão sendo reconhecidos

---

## Solução Proposta

### 1. Atualizar RPCs para usar `produto_marketplace_map`

Modificar `get_vendas_por_pedido` e `get_vendas_por_pedido_resumo` para seguir esta hierarquia de CMV:

```text
1) produto_id direto no item (prioridade absoluta)
2) produto_marketplace_map (mapeamento MLB SKU -> produto_id)
3) produtos.sku = sku_marketplace (fallback por SKU igual)
4) sku_costs (custo manual por SKU)
5) 0 (sem custo)
```

### 2. Migrar itens existentes

Criar migração que preenche `produto_id` em `marketplace_transaction_items` para todos os itens que têm mapeamento na tabela `produto_marketplace_map`:

```sql
UPDATE marketplace_transaction_items mti
SET produto_id = pmm.produto_id
FROM produto_marketplace_map pmm
JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
WHERE mti.sku_marketplace = pmm.sku_marketplace
  AND mt.empresa_id = pmm.empresa_id
  AND mti.produto_id IS NULL;
```

### 3. Sincronizar automaticamente novos mapeamentos

Quando um mapeamento é criado/atualizado em `produto_marketplace_map`, propagar automaticamente para os itens históricos via trigger ou hook no frontend.

### 4. Ajustar modal de mapeamento

Garantir que ao clicar "Vincular a produto existente":
1. Atualiza `marketplace_transaction_items.produto_id` no item atual
2. Cria/atualiza entrada em `produto_marketplace_map`
3. Propaga para itens históricos com mesmo SKU

---

## Detalhamento Técnico

### Arquivo: Nova migração SQL

```sql
-- 1. Função auxiliar para resolver produto_id via mapeamento
CREATE OR REPLACE FUNCTION get_produto_id_from_mapping(
  p_sku_marketplace TEXT,
  p_empresa_id UUID
)
RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT produto_id 
  FROM produto_marketplace_map 
  WHERE sku_marketplace = p_sku_marketplace 
    AND empresa_id = p_empresa_id 
    AND ativo = true
  LIMIT 1;
$$;

-- 2. Atualizar get_vendas_por_pedido com nova hierarquia
-- Hierarquia: produto_id -> pmm.produto_id -> sku match -> sku_costs -> 0
```

### Arquivo: `MapearCmvModal.tsx`

Modificar `handleVincularProduto` para:
1. Criar/atualizar entrada em `produto_marketplace_map` ANTES de atualizar o item
2. Atualizar o item atual com `produto_id`
3. Chamar RPC para propagar para itens históricos

### Arquivo: `useVendaItens.ts`

Ajustar hierarquia de custo para considerar mapeamento:
1. `produto_id` direto -> custo do produto
2. Buscar em `produto_marketplace_map` -> custo do produto mapeado
3. `sku_costs` -> custo manual
4. Fallback 0

---

## Sequência de Implementação

1. **Criar migração de dados** - Preencher `produto_id` nos 13.272 itens que já têm mapeamento
2. **Atualizar RPC `get_vendas_por_pedido`** - Incluir lookup em `produto_marketplace_map`
3. **Atualizar RPC `get_vendas_por_pedido_resumo`** - Mesma lógica
4. **Ajustar `MapearCmvModal`** - Criar mapeamento + atualizar item + propagar
5. **Ajustar `useVendaItens`** - Considerar mapeamento no hook de itens expandidos

---

## Impacto Esperado

Após implementação:
- Os 13.272 itens com mapeamento existente passarão a ter CMV calculado
- Novos mapeamentos serão refletidos imediatamente
- O botão "Mapear" aparecerá apenas para os ~2.826 itens (157 SKUs) realmente sem mapeamento

---

## Validação

Após implementação, executar:

```sql
SELECT 
  SUM(CASE WHEN cmv_total > 0 THEN 1 ELSE 0 END) as pedidos_com_cmv,
  SUM(CASE WHEN cmv_total = 0 OR cmv_total IS NULL THEN 1 ELSE 0 END) as pedidos_sem_cmv
FROM get_vendas_por_pedido(NULL, CURRENT_DATE - 30, CURRENT_DATE);
```

Resultado esperado: redução significativa de pedidos sem CMV.

