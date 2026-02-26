
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
  produto_empresa_id uuid,
  total_comissao numeric,
  total_tarifas numeric,
  total_frete_vendedor numeric,
  total_impostos numeric
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
      mt.empresa_id as mt_empresa_id,
      mt.id as mt_id,
      -- Custos do pedido (nível transação) para rateio proporcional
      COALESCE(mt.taxas, 0)::numeric as mt_taxas,
      COALESCE(mt.tarifas, 0)::numeric as mt_tarifas,
      COALESCE(mt.frete_vendedor, 0)::numeric as mt_frete_vendedor,
      COALESCE(mt.valor_bruto, 0)::numeric as mt_valor_bruto
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
  -- Calcular total do pedido para rateio proporcional
  pedido_totais AS (
    SELECT
      mt_id,
      SUM(preco_total) as total_pedido
    FROM itens_base
    GROUP BY mt_id
  ),
  -- Ratear custos do pedido proporcionalmente ao valor de cada item
  itens_com_rateio AS (
    SELECT
      ib.*,
      CASE WHEN pt.total_pedido > 0 
        THEN ib.preco_total / pt.total_pedido 
        ELSE 0 
      END as fator_rateio,
      -- Comissão = taxas (comissão ML)
      CASE WHEN pt.total_pedido > 0 
        THEN ib.mt_taxas * (ib.preco_total / pt.total_pedido)
        ELSE 0 
      END as comissao_rateada,
      -- Tarifas fixas
      CASE WHEN pt.total_pedido > 0 
        THEN ib.mt_tarifas * (ib.preco_total / pt.total_pedido)
        ELSE 0 
      END as tarifa_rateada,
      -- Frete vendedor
      CASE WHEN pt.total_pedido > 0 
        THEN ib.mt_frete_vendedor * (ib.preco_total / pt.total_pedido)
        ELSE 0 
      END as frete_vendedor_rateado
    FROM itens_base ib
    INNER JOIN pedido_totais pt ON pt.mt_id = ib.mt_id
  ),
  -- Buscar alíquota de imposto por empresa
  config_fiscal AS (
    SELECT 
      ecf.empresa_id,
      COALESCE(ecf.aliquota_imposto_vendas, 0) as aliquota
    FROM empresas_config_fiscal ecf
    WHERE ecf.empresa_id = ANY(v_user_empresa_ids)
  ),
  agregado_produto AS (
    SELECT
      ir.prod_key,
      MAX(ir.nome) as nome,
      MAX(ir.sku) as sku,
      MAX(ir.imagem_url) as imagem_url,
      (ARRAY_AGG(ir.item_anuncio_id ORDER BY (ir.item_anuncio_id IS NOT NULL) DESC, ir.preco_total DESC) FILTER (WHERE ir.item_anuncio_id IS NOT NULL))[1] as anuncio_id,
      (ARRAY_AGG(ir.mt_empresa_id ORDER BY (ir.item_anuncio_id IS NOT NULL) DESC, ir.preco_total DESC))[1] as representative_empresa_id,
      MAX(ir.item_thumbnail_url) as thumbnail_url,
      MAX(ir.custo)::numeric as custo_max,
      SUM(ir.quantidade)::numeric as qtd_sum,
      SUM(ir.preco_total)::numeric as faturado_sum,
      SUM(ir.comissao_rateada)::numeric as comissao_sum,
      SUM(ir.tarifa_rateada)::numeric as tarifa_sum,
      SUM(ir.frete_vendedor_rateado)::numeric as frete_vendedor_sum,
      -- Impostos: somar por item usando alíquota da empresa
      SUM(ir.preco_total * COALESCE(cf.aliquota, 0) / 100)::numeric as impostos_sum
    FROM itens_com_rateio ir
    LEFT JOIN config_fiscal cf ON cf.empresa_id = ir.mt_empresa_id
    GROUP BY ir.prod_key
  ),
  agregado_canal AS (
    SELECT
      ir.prod_key,
      jsonb_object_agg(
        ir.canal, 
        canal_qtd.total_qtd
      ) as por_canal_agg
    FROM (SELECT DISTINCT prod_key, canal FROM itens_com_rateio) ir
    INNER JOIN LATERAL (
      SELECT SUM(ir2.quantidade) as total_qtd
      FROM itens_com_rateio ir2
      WHERE ir2.prod_key = ir.prod_key AND ir2.canal = ir.canal
    ) canal_qtd ON true
    GROUP BY ir.prod_key
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
    ap.representative_empresa_id as produto_empresa_id,
    COALESCE(ap.comissao_sum, 0)::numeric as total_comissao,
    COALESCE(ap.tarifa_sum, 0)::numeric as total_tarifas,
    COALESCE(ap.frete_vendedor_sum, 0)::numeric as total_frete_vendedor,
    COALESCE(ap.impostos_sum, 0)::numeric as total_impostos
  FROM agregado_produto ap
  LEFT JOIN agregado_canal ac ON ac.prod_key = ap.prod_key
  ORDER BY ap.faturado_sum DESC NULLS LAST
  LIMIT p_limite;
END;
$$;
