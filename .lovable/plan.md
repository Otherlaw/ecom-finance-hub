
# Plano: Corrigir Top 10 Produtos para Buscar Custo por SKU

## Diagnóstico

Analisando os dados retornados pela RPC e o banco de dados:

| Métrica | Valor |
|---------|-------|
| Itens de marketplace | 30.791 |
| Com `produto_id` vinculado | 14.595 (47%) |
| Sem `produto_id` | 16.196 (53%) |
| Produtos com custo cadastrado | 63 de 64 |

### Problema Identificado

A RPC `get_top_produtos_vendidos` faz apenas:
```sql
LEFT JOIN produtos p ON p.id = mti.produto_id
```

Quando `mti.produto_id` é NULL (53% dos casos), o custo retorna 0 mesmo que o produto exista pelo SKU.

### Evidência

Testando o fallback por SKU:
- `CO-VG-PS4-PR` → custo R$ 42,00 (existe na tabela `produtos` pelo SKU)
- `02-JO-OR-UN` → custo R$ 11,40 (existe na tabela `produtos` pelo SKU)
- Atualmente retornam custo R$ 0,00 porque `produto_id` é NULL

## Solução

Modificar a RPC `get_top_produtos_vendidos` para:

1. **Primeiro** tentar buscar produto por `mti.produto_id`
2. **Fallback** buscar produto por `mti.sku_marketplace = p.sku` quando `produto_id` é NULL

## Implementação

### Arquivo: Nova migration SQL

```sql
CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(...)
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
BEGIN
  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas_items AS (
    SELECT
      -- Produto key: prioriza produto_id, senão usa SKU
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      -- Nome: prioriza produto vinculado, depois produto por SKU, depois descrição
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      -- SKU: prioriza produto vinculado, depois produto por SKU
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      -- Imagem: tenta ambos os joins
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      -- CUSTO: PRIORIZA produto por ID, FALLBACK por SKU
      COALESCE(p_by_id.custo_medio, p_by_sku.custo_medio, 0) as custo,
      COALESCE(mti.quantidade, 0) as quantidade,
      COALESCE(mti.preco_total, 0) as preco_total,
      mt.canal,
      mt.id as transaction_id,
      COALESCE(mt.custo_ads, 0) as custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    -- JOIN primário: por produto_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    -- JOIN fallback: por SKU quando produto_id é NULL
    LEFT JOIN produtos p_by_sku ON 
      mti.produto_id IS NULL 
      AND p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
    WHERE mt.empresa_id = p_empresa_id
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  ),
  -- ... resto da RPC igual
```

## Resultado Esperado

| Produto | Antes | Depois |
|---------|-------|--------|
| CO-VG-PS4-PR | CMV: R$ 0,00 | CMV: R$ 42,00 |
| 02-JO-OR-UN | CMV: R$ 0,00 | CMV: R$ 11,40 |
| MA-CA-DG-DR | CMV: R$ 0,00 | CMV: R$ 9,00 |

A margem será calculada corretamente usando o custo real do produto.

## Arquivos a Modificar

1. `supabase/migrations/[nova].sql` - Atualizar RPC `get_top_produtos_vendidos` com fallback por SKU

**Nenhuma alteração no frontend necessária** - a estrutura de dados permanece a mesma.
