
DROP FUNCTION IF EXISTS public.get_top_produtos_vendidos(uuid, date, date, integer);

CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - 30,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(
  produto_id text,
  produto_nome text,
  produto_sku text,
  produto_imagem_url text,
  produto_anuncio_id text,
  produto_thumbnail_url text,
  custo_unitario numeric,
  qtd_total numeric,
  total_faturado numeric,
  total_ads numeric,
  por_canal jsonb,
  produto_empresa_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN;
    END IF;
  END IF;
  
  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN;
  END IF;

  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH 
  itens_base AS (
    SELECT
      mti.id as item_id,
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      mti.anuncio_id as item_anuncio_id,
      mti.thumbnail_url as item_thumbnail_url,
      COALESCE(
        NULLIF(p_by_id.custo_medio, 0), 
        NULLIF(p_by_sku.custo_medio, 0), 
        NULLIF(sc.custo_unitario, 0),
        0
      )::numeric as custo,
      COALESCE(mti.quantidade, 1)::numeric as quantidade,
      COALESCE(mti.preco_total, 0)::numeric as preco_total,
      mt.canal,
      mt.empresa_id as mt_empresa_id
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND mti.produto_id IS NULL
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = mt.empresa_id
    WHERE 
      mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  agregado_produto AS (
    SELECT
      ib.prod_key,
      MAX(ib.nome) as nome,
      MAX(ib.sku) as sku,
      MAX(ib.imagem_url) as imagem_url,
      (ARRAY_AGG(ib.item_anuncio_id ORDER BY (ib.item_anuncio_id IS NOT NULL) DESC, ib.preco_total DESC) FILTER (WHERE ib.item_anuncio_id IS NOT NULL))[1] as anuncio_id,
      (ARRAY_AGG(ib.mt_empresa_id ORDER BY (ib.item_anuncio_id IS NOT NULL) DESC, ib.preco_total DESC))[1] as representative_empresa_id,
      MAX(ib.item_thumbnail_url) as thumbnail_url,
      MAX(ib.custo)::numeric as custo_max,
      SUM(ib.quantidade)::numeric as qtd_sum,
      SUM(ib.preco_total)::numeric as faturado_sum
    FROM itens_base ib
    GROUP BY ib.prod_key
  ),
  agregado_canal AS (
    SELECT
      ib.prod_key,
      jsonb_object_agg(
        ib.canal, 
        canal_qtd.total_qtd
      ) as por_canal_agg
    FROM (SELECT DISTINCT prod_key, canal FROM itens_base) ib
    INNER JOIN LATERAL (
      SELECT SUM(ib2.quantidade) as total_qtd
      FROM itens_base ib2
      WHERE ib2.prod_key = ib.prod_key AND ib2.canal = ib.canal
    ) canal_qtd ON true
    GROUP BY ib.prod_key
  )
  SELECT
    ap.prod_key as produto_id,
    ap.nome as produto_nome,
    ap.sku as produto_sku,
    COALESCE(ap.imagem_url, ap.thumbnail_url) as produto_imagem_url,
    ap.anuncio_id as produto_anuncio_id,
    ap.thumbnail_url as produto_thumbnail_url,
    ap.custo_max as custo_unitario,
    ap.qtd_sum as qtd_total,
    ap.faturado_sum as total_faturado,
    0::numeric as total_ads,
    COALESCE(ac.por_canal_agg, '{}'::jsonb) as por_canal,
    ap.representative_empresa_id as produto_empresa_id
  FROM agregado_produto ap
  LEFT JOIN agregado_canal ac ON ac.prod_key = ap.prod_key
  ORDER BY ap.faturado_sum DESC NULLS LAST
  LIMIT p_limite;
END;
$$;
