-- =============================================================================
-- PADRONIZAÇÃO: Todas as RPCs agora recebem DATE e calculam intervalo [inicio, fim_exclusivo)
-- fim_exclusivo = p_data_fim + 1 dia (início do dia seguinte no horário local → UTC)
-- =============================================================================

-- Helper: Converter DATE local para TIMESTAMPTZ (início do dia no fuso horário local = UTC-3)
CREATE OR REPLACE FUNCTION public.date_to_br_timestamptz(p_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
IMMUTABLE
AS $$
  -- Converte a data para início do dia no horário de Brasília (UTC-3)
  SELECT (p_date::TEXT || 'T00:00:00-03:00')::TIMESTAMPTZ;
$$;

-- =============================================================================
-- 1. get_dashboard_metrics - agora aceita DATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_dashboard_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Converter datas para TIMESTAMPTZ (intervalo [inicio, fim_exclusivo))
  v_inicio := public.date_to_br_timestamptz(p_data_inicio);
  v_fim_exclusivo := public.date_to_br_timestamptz(p_data_fim + 1);

  WITH transacoes AS (
    SELECT
      mt.canal,
      mt.pedido_id,
      mt.tipo_lancamento,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE 
      mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim_exclusivo
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  metricas_gerais AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS receita_bruta,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(taxas, 0) + COALESCE(tarifas, 0)), 0) AS total_tarifas,
      COALESCE(SUM(COALESCE(custo_ads, 0)), 0) AS total_ads,
      COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0) AS total_frete_vendedor,
      COALESCE(SUM(COALESCE(frete_comprador, 0)), 0) AS total_frete_comprador,
      COUNT(DISTINCT pedido_id) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM transacoes
  ),
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS liquido,
      COUNT(DISTINCT pedido_id) AS pedidos
    FROM transacoes
    GROUP BY canal
  )
  SELECT jsonb_build_object(
    'receita_bruta', mg.receita_bruta,
    'receita_liquida', mg.receita_liquida,
    'total_tarifas', mg.total_tarifas,
    'total_ads', mg.total_ads,
    'total_frete_vendedor', mg.total_frete_vendedor,
    'total_frete_comprador', mg.total_frete_comprador,
    'pedidos_unicos', mg.pedidos_unicos,
    'total_transacoes', mg.total_transacoes,
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb)
  ) INTO v_result
  FROM metricas_gerais mg;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 2. get_fechamento_metrics - agora aceita DATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_fechamento_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_fechamento_metrics(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_fechamento_metrics(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_inicio := public.date_to_br_timestamptz(p_data_inicio);
  v_fim_exclusivo := public.date_to_br_timestamptz(p_data_fim + 1);

  WITH transacoes AS (
    SELECT
      mt.canal,
      mt.status,
      mt.tipo_lancamento,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE 
      mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim_exclusivo
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  metricas_mkt AS (
    SELECT
      COUNT(*) AS total_transacoes,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS total_creditos,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'debito' THEN valor_bruto ELSE 0 END), 0) AS total_debitos,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS total_bruto,
      COALESCE(SUM(COALESCE(tarifas, 0)), 0) AS total_tarifas,
      COALESCE(SUM(COALESCE(taxas, 0)), 0) AS total_taxas,
      COALESCE(SUM(COALESCE(frete_comprador, 0)), 0) AS total_frete_comprador,
      COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0) AS total_frete_vendedor,
      COALESCE(SUM(COALESCE(custo_ads, 0)), 0) AS total_custo_ads,
      COUNT(*) FILTER (WHERE status = 'conciliado') AS conciliadas,
      COUNT(*) FILTER (WHERE status != 'conciliado') AS pendentes
    FROM transacoes
  ),
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS receita_bruta,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0)
      ELSE 0 END), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(taxas, 0) + COALESCE(tarifas, 0)), 0) AS tarifas,
      COUNT(*) AS total_transacoes
    FROM transacoes
    GROUP BY canal
  )
  SELECT jsonb_build_object(
    'marketplace', jsonb_build_object(
      'total_transacoes', mm.total_transacoes,
      'total_creditos', mm.total_creditos,
      'total_debitos', mm.total_debitos,
      'total_bruto', mm.total_bruto,
      'total_tarifas', mm.total_tarifas,
      'total_taxas', mm.total_taxas,
      'total_frete_comprador', mm.total_frete_comprador,
      'total_frete_vendedor', mm.total_frete_vendedor,
      'total_custo_ads', mm.total_custo_ads,
      'conciliadas', mm.conciliadas,
      'pendentes', mm.pendentes
    ),
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object(
        'receita_bruta', receita_bruta,
        'receita_liquida', receita_liquida,
        'tarifas', tarifas,
        'total_transacoes', total_transacoes
      ))
      FROM por_canal
    ), '{}'::jsonb)
  ) INTO v_result
  FROM metricas_mkt mm;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 3. get_vendas_por_pedido - agora aceita DATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(UUID, DATE, DATE, TEXT, TEXT, TEXT, INT, INT);

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
RETURNS TABLE (
  pedido_id TEXT,
  empresa_id UUID,
  canal TEXT,
  conta_nome TEXT,
  data_pedido TIMESTAMPTZ,
  data_repasse DATE,
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
  margem_contribuicao NUMERIC
)
LANGUAGE plpgsql
STABLE
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
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(fe.valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) AS ads_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('estorno', 'cancelamento', 'ajuste', 'outros') THEN fe.valor ELSE 0 END), 0) AS outros_eventos,
      COUNT(*) AS total_eventos
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
      COUNT(DISTINCT mti.id)::INT AS qtd_itens,
      COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0) AS cmv_total
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
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END AS comissao_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END AS tarifa_fixa_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END AS frete_vendedor_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END AS ads_total,
    ROUND(pb.valor_produto * 0.06, 2) AS impostos_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ABS(ep.outros_eventos) ELSE pb.outros_descontos_legado END AS outros_descontos_total,
    pb.valor_produto - 
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END -
      ROUND(pb.valor_produto * 0.06, 2) -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ABS(ep.outros_eventos) ELSE pb.outros_descontos_legado END
    AS valor_liquido_calculado,
    COALESCE(cp.qtd_itens, 0) AS qtd_itens,
    COALESCE(cp.cmv_total, 0) AS cmv_total,
    pb.valor_produto - 
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END -
      ROUND(pb.valor_produto * 0.06, 2) -
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ABS(ep.outros_eventos) ELSE pb.outros_descontos_legado END -
      COALESCE(cp.cmv_total, 0)
    AS margem_contribuicao
  FROM pedidos_base pb
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pb.pedido_id
  LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pb.pedido_id
  ORDER BY pb.data_pedido DESC, pb.pedido_id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- 4. get_vendas_por_pedido_count - agora aceita DATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(UUID, DATE, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_count BIGINT;
BEGIN
  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  SELECT COUNT(DISTINCT mt.pedido_id)
  INTO v_count
  FROM marketplace_transactions mt
  WHERE 
    mt.pedido_id IS NOT NULL
    AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
    AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
    AND (p_canal IS NULL OR mt.canal = p_canal)
    AND (p_conta IS NULL OR mt.conta_nome = p_conta)
    AND (p_status IS NULL OR mt.status = p_status);

  RETURN v_count;
END;
$$;

-- =============================================================================
-- 5. get_vendas_por_pedido_resumo - agora aceita DATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos BIGINT,
  total_itens BIGINT,
  valor_produto_total NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  valor_liquido_total NUMERIC,
  cmv_total NUMERIC,
  margem_contribuicao_total NUMERIC
)
LANGUAGE plpgsql
STABLE
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
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto,
      COALESCE(SUM(mt.taxas), 0) AS taxas_legado,
      COALESCE(SUM(mt.tarifas), 0) AS tarifas_legado,
      COALESCE(SUM(mt.frete_vendedor), 0) AS frete_vendedor_legado,
      COALESCE(SUM(mt.custo_ads), 0) AS ads_legado
    FROM marketplace_transactions mt
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
    GROUP BY mt.pedido_id
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(fe.valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) AS ads_eventos,
      COUNT(*) AS total_eventos
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
      COUNT(DISTINCT mti.id) AS qtd_itens,
      COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0) AS cmv
    FROM marketplace_transactions mt
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
    GROUP BY mt.pedido_id
  ),
  custos_finais AS (
    SELECT
      pb.pedido_id,
      pb.valor_produto,
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END AS comissao,
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END AS tarifa,
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END AS frete_vendedor,
      CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END AS ads,
      ROUND(pb.valor_produto * 0.06, 2) AS impostos,
      COALESCE(cp.qtd_itens, 0) AS qtd_itens,
      COALESCE(cp.cmv, 0) AS cmv
    FROM pedidos_base pb
    LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pb.pedido_id
    LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pb.pedido_id
  )
  SELECT
    COUNT(DISTINCT cf.pedido_id)::BIGINT AS total_pedidos,
    COALESCE(SUM(cf.qtd_itens), 0)::BIGINT AS total_itens,
    COALESCE(SUM(cf.valor_produto), 0) AS valor_produto_total,
    COALESCE(SUM(cf.comissao), 0) AS comissao_total,
    COALESCE(SUM(cf.tarifa), 0) AS tarifa_fixa_total,
    COALESCE(SUM(cf.frete_vendedor), 0) AS frete_vendedor_total,
    COALESCE(SUM(cf.ads), 0) AS ads_total,
    COALESCE(SUM(cf.impostos), 0) AS impostos_total,
    COALESCE(SUM(cf.valor_produto - cf.comissao - cf.tarifa - cf.frete_vendedor - cf.ads - cf.impostos), 0) AS valor_liquido_total,
    COALESCE(SUM(cf.cmv), 0) AS cmv_total,
    COALESCE(SUM(cf.valor_produto - cf.comissao - cf.tarifa - cf.frete_vendedor - cf.ads - cf.impostos - cf.cmv), 0) AS margem_contribuicao_total
  FROM custos_finais cf;
END;
$$;