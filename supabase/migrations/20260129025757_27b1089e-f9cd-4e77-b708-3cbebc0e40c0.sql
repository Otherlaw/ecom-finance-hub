-- Atualiza a RPC get_top_produtos_vendidos para buscar custo por SKU como fallback
-- quando o produto_id não está preenchido no item de marketplace

CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(
  produto_id text,
  produto_nome text,
  produto_sku text,
  produto_imagem_url text,
  custo_unitario numeric,
  qtd_total numeric,
  total_faturado numeric,
  total_ads numeric,
  por_canal jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
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
      -- Nome: prioriza produto por ID, depois por SKU, depois descrição
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      -- SKU: prioriza produto por ID, depois por SKU
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
  agregado AS (
    SELECT
      vi.prod_key,
      MAX(vi.nome) as nome,
      MAX(vi.sku) as sku,
      MAX(vi.imagem_url) as imagem_url,
      MAX(vi.custo) as custo,
      SUM(vi.quantidade) as qtd,
      SUM(vi.preco_total) as faturado
    FROM vendas_items vi
    GROUP BY vi.prod_key
  ),
  ads_por_produto AS (
    SELECT 
      vi.prod_key,
      SUM(DISTINCT vi.custo_ads) as total_ads
    FROM vendas_items vi
    GROUP BY vi.prod_key
  ),
  canais AS (
    SELECT
      vi.prod_key,
      vi.canal,
      SUM(vi.quantidade) as qtd_canal
    FROM vendas_items vi
    GROUP BY vi.prod_key, vi.canal
  ),
  canais_agregados AS (
    SELECT
      c.prod_key,
      jsonb_object_agg(COALESCE(c.canal, 'Outros'), c.qtd_canal) as por_canal
    FROM canais c
    GROUP BY c.prod_key
  )
  SELECT
    a.prod_key::text as produto_id,
    a.nome::text as produto_nome,
    a.sku::text as produto_sku,
    a.imagem_url::text as produto_imagem_url,
    a.custo::numeric as custo_unitario,
    a.qtd::numeric as qtd_total,
    a.faturado::numeric as total_faturado,
    COALESCE(ap.total_ads, 0)::numeric as total_ads,
    COALESCE(ca.por_canal, '{}'::jsonb) as por_canal
  FROM agregado a
  LEFT JOIN ads_por_produto ap ON ap.prod_key = a.prod_key
  LEFT JOIN canais_agregados ca ON ca.prod_key = a.prod_key
  ORDER BY a.qtd DESC
  LIMIT p_limite;
END;
$$;