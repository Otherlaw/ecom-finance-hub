-- =============================================================================
-- RPC unificada para KPIs do Dashboard que respeita QUALQUER período
-- Inclui: vendas, CMV, despesas operacionais - tudo calculado no período selecionado
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_period(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Converter datas para TIMESTAMPTZ (intervalo [inicio, fim_exclusivo))
  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  WITH 
  -- 1. Métricas de vendas marketplace (transações)
  vendas_transacoes AS (
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
      (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  -- 2. Eventos financeiros granulares (comissao, tarifa_fixa, etc.)
  eventos_financeiros AS (
    SELECT
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor
    FROM marketplace_financial_events fe
    WHERE 
      (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
  ),
  
  -- 3. CMV calculado a partir dos itens vendidos
  cmv_periodo AS (
    SELECT
      COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0) AS cmv_total,
      COUNT(DISTINCT CASE WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0 THEN mti.id END) AS itens_com_custo,
      COUNT(DISTINCT mti.id) AS total_itens
    FROM marketplace_transactions mt
    INNER JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE 
      mt.tipo_lancamento = 'credito'
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  -- 4. Despesas operacionais (bank_transactions com tipo_lancamento = 'saida' ou 'debito')
  despesas_banco AS (
    SELECT
      COALESCE(SUM(ABS(bt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM bank_transactions bt
    WHERE 
      bt.tipo_lancamento IN ('saida', 'debito')
      AND bt.status != 'cancelado'
      AND (v_inicio IS NULL OR bt.data_transacao::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR bt.data_transacao::TIMESTAMPTZ < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR bt.empresa_id = p_empresa_id)
  ),
  
  -- 5. Despesas de movimentações manuais
  despesas_manuais AS (
    SELECT
      COALESCE(SUM(ABS(mt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM manual_transactions mt
    WHERE 
      mt.tipo IN ('saida', 'despesa')
      AND mt.status = 'aprovado'
      AND (v_inicio IS NULL OR mt.data::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data::TIMESTAMPTZ < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  -- 6. Agregação de métricas de vendas
  metricas_vendas AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS faturamento_bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(taxas, 0)), 0) AS comissao_total_legado,
      COALESCE(SUM(COALESCE(tarifas, 0)), 0) AS tarifa_fixa_total_legado,
      COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0) AS frete_vendedor_total,
      COALESCE(SUM(COALESCE(frete_comprador, 0)), 0) AS frete_comprador_total,
      COALESCE(SUM(COALESCE(custo_ads, 0)), 0) AS ads_total,
      COUNT(DISTINCT pedido_id) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM vendas_transacoes
  ),
  
  -- 7. Agregação de eventos financeiros (preferência sobre campos legados)
  metricas_eventos AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_evento = 'comissao' THEN ABS(valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'frete_vendedor' THEN ABS(valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'ads' THEN ABS(valor) ELSE 0 END), 0) AS ads_eventos,
      COUNT(*) AS total_eventos
    FROM eventos_financeiros
  ),
  
  -- 8. Receita por canal
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS liquido,
      COUNT(DISTINCT pedido_id) AS pedidos
    FROM vendas_transacoes
    GROUP BY canal
  )
  
  SELECT jsonb_build_object(
    -- Métricas de vendas
    'faturamento_bruto', mv.faturamento_bruto,
    'receita_liquida', mv.receita_liquida,
    'pedidos_unicos', mv.pedidos_unicos,
    'total_transacoes', mv.total_transacoes,
    
    -- Custos de venda (preferência para eventos, fallback para legado)
    'comissao_total', CASE WHEN me.total_eventos > 0 THEN me.comissao_eventos ELSE mv.comissao_total_legado END,
    'tarifa_fixa_total', CASE WHEN me.total_eventos > 0 THEN me.tarifa_eventos ELSE mv.tarifa_fixa_total_legado END,
    'frete_vendedor_total', CASE WHEN me.total_eventos > 0 THEN me.frete_vendedor_eventos ELSE mv.frete_vendedor_total END,
    'ads_total', CASE WHEN me.total_eventos > 0 THEN me.ads_eventos ELSE mv.ads_total END,
    
    -- Imposto estimado (6% do faturamento bruto - regra padrão do sistema)
    'impostos_total', ROUND(mv.faturamento_bruto * 0.06, 2),
    'impostos_estimado', TRUE,
    
    -- CMV
    'cmv_total', cmv.cmv_total,
    'cmv_itens_com_custo', cmv.itens_com_custo,
    'cmv_total_itens', cmv.total_itens,
    'cmv_completo', cmv.itens_com_custo = cmv.total_itens AND cmv.total_itens > 0,
    
    -- Despesas operacionais
    'despesas_operacionais_total', db.total_despesas + dm.total_despesas,
    'despesas_banco', db.total_despesas,
    'despesas_manuais', dm.total_despesas,
    'qtd_despesas', db.qtd_despesas + dm.qtd_despesas,
    
    -- Lucro bruto e líquido calculados
    'lucro_bruto', mv.receita_liquida - cmv.cmv_total,
    'lucro_liquido', mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas),
    
    -- Margens (se faturamento > 0)
    'margem_bruta_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'margem_liquida_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas)) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    
    -- Ticket médio
    'ticket_medio', CASE WHEN mv.pedidos_unicos > 0 
      THEN ROUND(mv.faturamento_bruto / mv.pedidos_unicos, 2) 
      ELSE 0 END,
    
    -- Por canal (para gráficos)
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb),
    
    -- Flags de completude
    'tem_eventos_financeiros', me.total_eventos > 0
  ) INTO v_result
  FROM metricas_vendas mv
  CROSS JOIN metricas_eventos me
  CROSS JOIN cmv_periodo cmv
  CROSS JOIN despesas_banco db
  CROSS JOIN despesas_manuais dm;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_dashboard_kpis_period IS 'Retorna todos os KPIs do Dashboard para qualquer período, incluindo vendas, CMV, despesas e margens calculadas.';