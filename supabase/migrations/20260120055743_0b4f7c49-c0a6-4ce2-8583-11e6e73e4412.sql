-- =====================================================
-- MIGRATION: Ajustar RPC get_vendas_por_pedido para novas origens
-- Priorizar: report > api_conciliacoes > estimado_listing_prices > sale_fee > api_orders
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  pedido_id TEXT,
  empresa_id UUID,
  canal TEXT,
  conta_nome TEXT,
  data_pedido TIMESTAMPTZ,
  data_repasse TIMESTAMPTZ,
  status TEXT,
  tipo_envio TEXT,
  valor_produto NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  outros_descontos_total NUMERIC,
  valor_liquido_calculado NUMERIC,
  qtd_itens INT,
  cmv_total NUMERIC,
  margem_contribuicao NUMERIC,
  tem_cmv BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
BEGIN
  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      COALESCE(MAX(CASE WHEN mt.status = 'conciliado' THEN 'conciliado' END), MAX(mt.status)) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto,
      COALESCE(SUM(mt.taxas), 0) AS taxas_legado,
      COALESCE(SUM(mt.tarifas), 0) AS tarifas_legado,
      COALESCE(SUM(mt.frete_vendedor), 0) AS frete_vendedor_legado,
      COALESCE(SUM(mt.custo_ads), 0) AS ads_legado,
      COALESCE(SUM(mt.outros_descontos), 0) AS outros_descontos_legado
    FROM marketplace_transactions mt
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
    GROUP BY mt.pedido_id, mt.empresa_id, mt.canal, mt.conta_nome
  ),
  -- PRIORIZAR: report > api_conciliacoes > estimado_listing_prices > sale_fee > api_orders
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      -- Comissão: priorizar report, depois qualquer outra origem
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem NOT IN ('report', 'api_conciliacoes') THEN ABS(fe.valor) END),
        0
      ) AS comissao_eventos,
      -- Tarifa fixa: priorizar report, depois api_conciliacoes, depois estimado_listing_prices
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'estimado_listing_prices' THEN ABS(fe.valor) END),
        0
      ) AS tarifa_fixa_eventos,
      -- Tarifa financeira: mesma lógica
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem NOT IN ('report', 'api_conciliacoes') THEN ABS(fe.valor) END),
        0
      ) AS tarifa_financeira_eventos,
      -- Frete vendedor
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) END),
        0
      ) AS frete_vendedor_eventos,
      -- Ads
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) END),
        0
      ) AS ads_eventos,
      -- Outros
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('estorno', 'cancelamento', 'ajuste', 'outros') THEN fe.valor ELSE 0 END), 0) AS outros_eventos,
      COUNT(*) AS total_eventos,
      BOOL_OR(fe.origem = 'report') AS tem_dados_report,
      BOOL_OR(fe.origem = 'estimado_listing_prices') AS tem_dados_estimados
    FROM marketplace_financial_events fe
    WHERE 
      fe.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
      AND (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
    GROUP BY fe.pedido_id
  ),
  cmv_por_pedido AS (
    SELECT
      mt.pedido_id,
      COALESCE(SUM(mti.quantidade), 0)::INT AS qtd_itens,
      COUNT(CASE WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0 THEN 1 END) AS itens_com_custo,
      COUNT(CASE WHEN mti.produto_id IS NOT NULL THEN 1 END) AS itens_mapeados,
      SUM(mti.quantidade * p.custo_medio) AS cmv_calculado
    FROM marketplace_transactions mt
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
    GROUP BY mt.pedido_id
  )
  SELECT
    pb.pedido_id,
    pb.empresa_id,
    pb.canal,
    pb.conta_nome,
    pb.data_pedido,
    pb.data_repasse,
    pb.status,
    pb.tipo_envio,
    pb.valor_produto,
    -- Comissão: só comissao, NÃO inclui tarifa_fixa
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END AS comissao_total,
    -- Tarifa: tarifa_fixa + tarifa_financeira
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN (COALESCE(ep.tarifa_fixa_eventos, 0) + COALESCE(ep.tarifa_financeira_eventos, 0)) ELSE pb.tarifas_legado END AS tarifa_fixa_total,
    -- Frete vendedor
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END AS frete_vendedor_total,
    -- Ads
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END AS ads_total,
    0::NUMERIC AS impostos_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.outros_eventos ELSE pb.outros_descontos_legado END AS outros_descontos_total,
    -- Valor líquido: bruto - comissão - tarifas - frete_vendedor - ads
    pb.valor_produto 
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN (COALESCE(ep.tarifa_fixa_eventos, 0) + COALESCE(ep.tarifa_financeira_eventos, 0)) ELSE pb.tarifas_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END)
    AS valor_liquido_calculado,
    COALESCE(cp.qtd_itens, 1)::INT AS qtd_itens,
    CASE WHEN COALESCE(cp.itens_com_custo, 0) = 0 THEN NULL ELSE cp.cmv_calculado END AS cmv_total,
    CASE WHEN COALESCE(cp.itens_com_custo, 0) = 0 THEN NULL ELSE (
      pb.valor_produto
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN (COALESCE(ep.tarifa_fixa_eventos, 0) + COALESCE(ep.tarifa_financeira_eventos, 0)) ELSE pb.tarifas_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END)
      - COALESCE(cp.cmv_calculado, 0)
    ) END AS margem_contribuicao,
    COALESCE(cp.itens_com_custo, 0) > 0 AS tem_cmv
  FROM pedidos_base pb
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pb.pedido_id
  LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pb.pedido_id
  ORDER BY pb.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_vendas_por_pedido IS 
'RPC para listar vendas por pedido. Prioriza: report > api_conciliacoes > estimado_listing_prices. Comissão NÃO inclui tarifa_fixa. Tarifa = tarifa_fixa + tarifa_financeira.';