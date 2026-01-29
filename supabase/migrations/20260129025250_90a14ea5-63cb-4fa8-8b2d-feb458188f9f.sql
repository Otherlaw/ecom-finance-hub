-- RPC otimizada para Top 10 produtos mais vendidos
-- Move a agregação para o banco, evitando timeout com 30k+ registros

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
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      COALESCE(p.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p.sku, mti.sku_marketplace, '-') as sku,
      p.imagem_url,
      COALESCE(p.custo_medio, 0) as custo,
      COALESCE(mti.quantidade, 0) as quantidade,
      COALESCE(mti.preco_total, 0) as preco_total,
      mt.canal,
      mt.id as transaction_id,
      COALESCE(mt.custo_ads, 0) as custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mt.empresa_id = p_empresa_id
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  ),
  agregado_por_produto AS (
    SELECT
      prod_key,
      MAX(nome) as nome,
      MAX(sku) as sku,
      MAX(imagem_url) as imagem_url,
      MAX(custo) as custo,
      SUM(quantidade) as qtd_total,
      SUM(preco_total) as total_faturado
    FROM vendas_items
    GROUP BY prod_key
  ),
  por_canal AS (
    SELECT
      prod_key,
      jsonb_object_agg(
        COALESCE(canal, 'Outros'),
        qtd_canal
      ) as canal_data
    FROM (
      SELECT 
        prod_key,
        canal,
        SUM(quantidade)::numeric as qtd_canal
      FROM vendas_items
      GROUP BY prod_key, canal
    ) sub
    GROUP BY prod_key
  ),
  ads_por_produto AS (
    SELECT
      prod_key,
      SUM(custo_ads) as total_ads
    FROM (
      SELECT DISTINCT
        prod_key,
        transaction_id,
        custo_ads
      FROM vendas_items
    ) dist_trans
    GROUP BY prod_key
  )
  SELECT
    a.prod_key::text as produto_id,
    a.nome::text as produto_nome,
    a.sku::text as produto_sku,
    a.imagem_url::text as produto_imagem_url,
    a.custo::numeric as custo_unitario,
    a.qtd_total::numeric as qtd_total,
    a.total_faturado::numeric as total_faturado,
    COALESCE(ads.total_ads, 0)::numeric as total_ads,
    COALESCE(pc.canal_data, '{}'::jsonb) as por_canal
  FROM agregado_por_produto a
  LEFT JOIN por_canal pc ON pc.prod_key = a.prod_key
  LEFT JOIN ads_por_produto ads ON ads.prod_key = a.prod_key
  ORDER BY a.qtd_total DESC
  LIMIT p_limite;
END;
$$;