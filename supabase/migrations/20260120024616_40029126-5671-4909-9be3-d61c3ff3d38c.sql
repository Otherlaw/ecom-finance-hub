-- Corrigir RPC get_vendas_por_pedido para calcular qtd_itens corretamente (SUM ao invés de COUNT)
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  canal text,
  conta_nome text,
  data_pedido timestamp with time zone,
  data_repasse date,
  status text,
  tipo_envio text,
  valor_produto numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  outros_descontos_total numeric,
  valor_liquido_calculado numeric,
  qtd_itens integer,
  cmv_total numeric,
  margem_contribuicao numeric
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
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
      -- CORRIGIDO: SUM de quantidade ao invés de COUNT de itens
      COALESCE(SUM(mti.quantidade), 0)::INT AS qtd_itens,
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
    0::numeric AS impostos_total, -- Placeholder para impostos
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.outros_eventos ELSE pb.outros_descontos_legado END AS outros_descontos_total,
    (pb.valor_produto - 
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END) -
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END)
    ) AS valor_liquido_calculado,
    COALESCE(cp.qtd_itens, 0) AS qtd_itens,
    COALESCE(cp.cmv_total, 0) AS cmv_total,
    (pb.valor_produto - 
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END) -
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END) -
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END) -
      (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END) -
      COALESCE(cp.cmv_total, 0)
    ) AS margem_contribuicao
  FROM pedidos_base pb
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pb.pedido_id
  LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pb.pedido_id
  ORDER BY pb.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;