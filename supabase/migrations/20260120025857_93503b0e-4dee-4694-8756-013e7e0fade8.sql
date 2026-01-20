-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE PARA VOLUMES ALTOS
-- =====================================================

-- 1) Índices compostos otimizados para queries frequentes
-- =====================================================

-- marketplace_transactions: pedido_id com tipo_transacao para agregação por pedido
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pedido_tipo 
ON public.marketplace_transactions (empresa_id, pedido_id, tipo_transacao, tipo_lancamento)
WHERE pedido_id IS NOT NULL;

-- marketplace_transactions: data_transacao com filtros comuns para Dashboard/Vendas
CREATE INDEX IF NOT EXISTS idx_mkt_tx_empresa_data_lancamento 
ON public.marketplace_transactions (empresa_id, data_transacao, tipo_lancamento);

-- marketplace_financial_events: índice para joins com pedido
CREATE INDEX IF NOT EXISTS idx_mkt_events_empresa_pedido 
ON public.marketplace_financial_events (empresa_id, pedido_id, data_evento)
WHERE pedido_id IS NOT NULL;

-- contas_a_pagar: vencimento para alertas e fluxo de caixa
CREATE INDEX IF NOT EXISTS idx_cp_empresa_vencimento 
ON public.contas_a_pagar (empresa_id, data_vencimento, status);

-- contas_a_receber: vencimento para alertas e fluxo de caixa  
CREATE INDEX IF NOT EXISTS idx_cr_empresa_vencimento 
ON public.contas_a_receber (empresa_id, data_vencimento, status);

-- 2) Materialized View para métricas diárias do Dashboard
-- =====================================================

-- Dropar se existir para recriar
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_metricas_diarias;

-- View materializada com agregações diárias por empresa e canal
CREATE MATERIALIZED VIEW mv_dashboard_metricas_diarias AS
SELECT 
  mt.empresa_id,
  mt.canal,
  DATE(mt.data_transacao AT TIME ZONE 'America/Sao_Paulo') AS data_local,
  COUNT(DISTINCT mt.pedido_id) AS pedidos_unicos,
  COUNT(*) AS total_transacoes,
  COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' THEN mt.valor_bruto ELSE 0 END), 0) AS receita_bruta,
  COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' THEN 
    mt.valor_bruto - COALESCE(mt.taxas, 0) - COALESCE(mt.tarifas, 0) - COALESCE(mt.frete_vendedor, 0) - COALESCE(mt.custo_ads, 0)
  ELSE 0 END), 0) AS receita_liquida,
  COALESCE(SUM(mt.taxas), 0) AS total_taxas,
  COALESCE(SUM(mt.tarifas), 0) AS total_tarifas,
  COALESCE(SUM(mt.frete_vendedor), 0) AS total_frete_vendedor,
  COALESCE(SUM(mt.frete_comprador), 0) AS total_frete_comprador,
  COALESCE(SUM(mt.custo_ads), 0) AS total_ads
FROM marketplace_transactions mt
WHERE mt.tipo_transacao = 'venda'
GROUP BY mt.empresa_id, mt.canal, DATE(mt.data_transacao AT TIME ZONE 'America/Sao_Paulo');

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX idx_mv_dashboard_pk 
ON mv_dashboard_metricas_diarias (empresa_id, canal, data_local);

-- Índice para queries por período
CREATE INDEX idx_mv_dashboard_empresa_data 
ON mv_dashboard_metricas_diarias (empresa_id, data_local);

-- 3) Função para refresh da materialized view
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_dashboard_metricas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metricas_diarias;
END;
$$;

-- 4) RPC otimizada que usa a materialized view
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
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
  v_result JSONB;
BEGIN
  WITH metricas AS (
    SELECT
      COALESCE(SUM(receita_bruta), 0) AS receita_bruta,
      COALESCE(SUM(receita_liquida), 0) AS receita_liquida,
      COALESCE(SUM(total_taxas + total_tarifas), 0) AS total_tarifas,
      COALESCE(SUM(total_ads), 0) AS total_ads,
      COALESCE(SUM(total_frete_vendedor), 0) AS total_frete_vendedor,
      COALESCE(SUM(total_frete_comprador), 0) AS total_frete_comprador,
      COALESCE(SUM(pedidos_unicos), 0) AS pedidos_unicos,
      COALESCE(SUM(total_transacoes), 0) AS total_transacoes
    FROM mv_dashboard_metricas_diarias
    WHERE 
      (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR data_local >= p_data_inicio)
      AND (p_data_fim IS NULL OR data_local <= p_data_fim)
  ),
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(receita_bruta), 0) AS bruto,
      COALESCE(SUM(receita_liquida), 0) AS liquido,
      COALESCE(SUM(pedidos_unicos), 0) AS pedidos
    FROM mv_dashboard_metricas_diarias
    WHERE 
      (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR data_local >= p_data_inicio)
      AND (p_data_fim IS NULL OR data_local <= p_data_fim)
    GROUP BY canal
  )
  SELECT jsonb_build_object(
    'receita_bruta', m.receita_bruta,
    'receita_liquida', m.receita_liquida,
    'total_tarifas', m.total_tarifas,
    'total_ads', m.total_ads,
    'total_frete_vendedor', m.total_frete_vendedor,
    'total_frete_comprador', m.total_frete_comprador,
    'pedidos_unicos', m.pedidos_unicos,
    'total_transacoes', m.total_transacoes,
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb)
  ) INTO v_result
  FROM metricas m;

  RETURN v_result;
END;
$$;