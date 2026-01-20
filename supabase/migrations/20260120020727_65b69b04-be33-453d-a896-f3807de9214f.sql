
-- =============================================================================
-- Atualizar RPC: get_vendas_por_pedido
-- Agora usa marketplace_financial_events para somar custos reais por pedido
-- Fallback para campos legados em marketplace_transactions quando não há eventos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL,
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
  -- Valores
  valor_produto NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  outros_descontos_total NUMERIC,
  valor_liquido_calculado NUMERIC,
  -- CMV e margem
  qtd_itens INT,
  cmv_total NUMERIC,
  margem_contribuicao NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH pedidos_base AS (
    -- Agregar transações por pedido_id (dados base da venda)
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      COALESCE(
        MAX(CASE WHEN mt.status = 'conciliado' THEN 'conciliado' END),
        MAX(mt.status)
      ) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      -- Valor do produto = soma dos créditos de venda
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto,
      -- Campos legados (fallback quando não há eventos)
      COALESCE(SUM(mt.taxas), 0) AS taxas_legado,
      COALESCE(SUM(mt.tarifas), 0) AS tarifas_legado,
      COALESCE(SUM(mt.frete_vendedor), 0) AS frete_vendedor_legado,
      COALESCE(SUM(mt.custo_ads), 0) AS ads_legado,
      COALESCE(SUM(mt.outros_descontos), 0) AS outros_descontos_legado
    FROM marketplace_transactions mt
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
    GROUP BY mt.pedido_id, mt.empresa_id, mt.canal, mt.conta_nome
  ),
  -- Somar eventos financeiros da nova tabela por pedido
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
      AND (p_data_inicio IS NULL OR fe.data_evento >= p_data_inicio)
      AND (p_data_fim IS NULL OR fe.data_evento < p_data_fim)
    GROUP BY fe.pedido_id
  ),
  -- Calcular CMV por pedido (join com itens e produtos)
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
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
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
    -- PRIORIZAR eventos financeiros reais, fallback para campos legados
    CASE 
      WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos
      ELSE pb.taxas_legado
    END AS comissao_total,
    CASE 
      WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos
      ELSE pb.tarifas_legado
    END AS tarifa_fixa_total,
    CASE 
      WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos
      ELSE pb.frete_vendedor_legado
    END AS frete_vendedor_total,
    CASE 
      WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos
      ELSE pb.ads_legado
    END AS ads_total,
    -- Impostos estimados (6% do valor bruto)
    ROUND(pb.valor_produto * 0.06, 2) AS impostos_total,
    CASE 
      WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ABS(ep.outros_eventos)
      ELSE pb.outros_descontos_legado
    END AS outros_descontos_total,
    -- Valor líquido calculado
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
    -- Margem de contribuição = líquido - CMV
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
-- Atualizar RPC: get_vendas_por_pedido_resumo
-- Também usar eventos financeiros quando disponíveis
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL
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
BEGIN
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
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
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
      AND (p_data_inicio IS NULL OR fe.data_evento >= p_data_inicio)
      AND (p_data_fim IS NULL OR fe.data_evento < p_data_fim)
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
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
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
