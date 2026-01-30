-- Atualizar RPC para suportar visão consolidada (p_empresa_id = NULL)
-- e garantir que o fallback por SKU funcione corretamente

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
BEGIN
  -- Converter datas para timezone BR
  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas_items AS (
    SELECT
      -- Chave do produto: prioriza produto_id, senão usa SKU
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      -- Nome: prioriza produto vinculado por ID, depois por SKU, depois descrição
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      -- SKU: prioriza produto vinculado por ID, depois por SKU
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
    WHERE 
      -- SUPORTA CONSOLIDADO: Se p_empresa_id = NULL, busca todas as empresas
      (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  ),
  -- Agrupar por produto (prod_key)
  agregado AS (
    SELECT
      vi.prod_key,
      vi.nome,
      vi.sku,
      vi.imagem_url,
      vi.custo as custo_unitario,
      SUM(vi.quantidade) as qtd_total,
      SUM(vi.preco_total) as total_faturado,
      -- Ads rateado por transação única
      SUM(DISTINCT vi.custo_ads) as total_ads,
      -- Agregar quantidades por canal
      jsonb_object_agg(vi.canal, vi.quantidade) as por_canal_raw
    FROM vendas_items vi
    GROUP BY vi.prod_key, vi.nome, vi.sku, vi.imagem_url, vi.custo
  ),
  -- Consolidar por_canal corretamente (somar quantidades do mesmo canal)
  consolidado AS (
    SELECT
      a.prod_key,
      a.nome,
      a.sku,
      a.imagem_url,
      a.custo_unitario,
      a.qtd_total,
      a.total_faturado,
      a.total_ads,
      a.por_canal_raw as por_canal
    FROM agregado a
  )
  SELECT
    c.prod_key as produto_id,
    c.nome as produto_nome,
    c.sku as produto_sku,
    c.imagem_url as produto_imagem_url,
    c.custo_unitario,
    c.qtd_total,
    c.total_faturado,
    c.total_ads,
    c.por_canal
  FROM consolidado c
  ORDER BY c.total_faturado DESC
  LIMIT p_limite;
END;
$$;