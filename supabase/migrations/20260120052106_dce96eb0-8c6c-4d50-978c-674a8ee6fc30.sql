-- =====================================================
-- MIGRATION: Checklist como Motor de Fechamento
-- Garantir idempotência e prioridade de relatórios sobre API
-- =====================================================

-- 1. Adicionar constraint única para idempotência de eventos
-- event_id já deve ser único, mas garantir que seja por empresa/canal
ALTER TABLE public.marketplace_financial_events
DROP CONSTRAINT IF EXISTS uq_mkt_fin_event_key;

ALTER TABLE public.marketplace_financial_events
ADD CONSTRAINT uq_mkt_fin_event_key 
UNIQUE (empresa_id, canal, event_id);

-- 2. Criar índice para buscas por pedido_id (otimização)
CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_pedido 
ON public.marketplace_financial_events(pedido_id);

-- 3. Criar índice para filtrar por origem (api vs report)
CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_origem 
ON public.marketplace_financial_events(origem);

-- 4. Atualizar RPC get_vendas_por_pedido para priorizar origem='report'
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
  -- PRIORIZAR origem='report' sobre origem='api'
  -- Se existem eventos de 'report', usar eles; senão usar 'api'
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      -- Para cada tipo de evento, pegar valor do 'report' se existir, senão do 'api'
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'api' THEN ABS(fe.valor) END),
        0
      ) AS comissao_eventos,
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.origem = 'api' THEN ABS(fe.valor) END),
        0
      ) AS tarifa_eventos,
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.origem = 'api' THEN ABS(fe.valor) END),
        0
      ) AS frete_vendedor_eventos,
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.origem = 'api' THEN ABS(fe.valor) END),
        0
      ) AS ads_eventos,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('estorno', 'cancelamento', 'ajuste', 'outros') THEN fe.valor ELSE 0 END), 0) AS outros_eventos,
      COUNT(*) AS total_eventos,
      -- Flag para indicar se tem dados do relatório
      BOOL_OR(fe.origem = 'report') AS tem_dados_report
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
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END AS comissao_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END AS tarifa_fixa_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.frete_vendedor_eventos ELSE pb.frete_vendedor_legado END AS frete_vendedor_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.ads_eventos ELSE pb.ads_legado END AS ads_total,
    0::NUMERIC AS impostos_total,
    CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.outros_eventos ELSE pb.outros_descontos_legado END AS outros_descontos_total,
    pb.valor_produto - CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos + ep.tarifa_eventos ELSE pb.taxas_legado + pb.tarifas_legado END AS valor_liquido_calculado,
    COALESCE(cp.qtd_itens, 1)::INT AS qtd_itens,
    CASE WHEN COALESCE(cp.itens_com_custo, 0) = 0 THEN NULL ELSE cp.cmv_calculado END AS cmv_total,
    CASE WHEN COALESCE(cp.itens_com_custo, 0) = 0 THEN NULL ELSE (
      pb.valor_produto
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.comissao_eventos ELSE pb.taxas_legado END)
      - (CASE WHEN COALESCE(ep.total_eventos, 0) > 0 THEN ep.tarifa_eventos ELSE pb.tarifas_legado END)
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

-- 5. Atualizar também get_dashboard_kpis_period para priorizar relatório
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
  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  WITH 
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
  
  -- Eventos com prioridade para 'report'
  eventos_financeiros AS (
    SELECT
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor,
      fe.origem,
      -- Rank: report = 1, api = 2
      ROW_NUMBER() OVER (
        PARTITION BY fe.pedido_id, fe.tipo_evento 
        ORDER BY CASE WHEN fe.origem = 'report' THEN 1 ELSE 2 END
      ) AS rn
    FROM marketplace_financial_events fe
    WHERE 
      (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
  ),
  eventos_priorizados AS (
    SELECT pedido_id, tipo_evento, valor, origem
    FROM eventos_financeiros
    WHERE rn = 1
  ),
  
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
  
  metricas_eventos AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_evento = 'comissao' THEN ABS(valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'frete_vendedor' THEN ABS(valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'ads' THEN ABS(valor) ELSE 0 END), 0) AS ads_eventos,
      COUNT(*) AS total_eventos,
      COUNT(*) FILTER (WHERE origem = 'report') AS eventos_report
    FROM eventos_priorizados
  ),
  
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
    'faturamento_bruto', mv.faturamento_bruto,
    'receita_liquida', mv.receita_liquida,
    'pedidos_unicos', mv.pedidos_unicos,
    'total_transacoes', mv.total_transacoes,
    'comissao_total', CASE WHEN me.total_eventos > 0 THEN me.comissao_eventos ELSE mv.comissao_total_legado END,
    'tarifa_fixa_total', CASE WHEN me.total_eventos > 0 THEN me.tarifa_eventos ELSE mv.tarifa_fixa_total_legado END,
    'frete_vendedor_total', CASE WHEN me.total_eventos > 0 THEN me.frete_vendedor_eventos ELSE mv.frete_vendedor_total END,
    'ads_total', CASE WHEN me.total_eventos > 0 THEN me.ads_eventos ELSE mv.ads_total END,
    'impostos_total', ROUND(mv.faturamento_bruto * 0.06, 2),
    'impostos_estimado', TRUE,
    'cmv_total', cmv.cmv_total,
    'cmv_itens_com_custo', cmv.itens_com_custo,
    'cmv_total_itens', cmv.total_itens,
    'cmv_completo', cmv.itens_com_custo = cmv.total_itens AND cmv.total_itens > 0,
    'despesas_operacionais_total', db.total_despesas + dm.total_despesas,
    'despesas_banco', db.total_despesas,
    'despesas_manuais', dm.total_despesas,
    'qtd_despesas', db.qtd_despesas + dm.qtd_despesas,
    'lucro_bruto', mv.receita_liquida - cmv.cmv_total,
    'lucro_liquido', mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas),
    'margem_bruta_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'margem_liquida_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas)) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'ticket_medio', CASE WHEN mv.pedidos_unicos > 0 
      THEN ROUND(mv.faturamento_bruto / mv.pedidos_unicos, 2) 
      ELSE 0 END,
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb),
    'tem_eventos_financeiros', me.total_eventos > 0,
    'eventos_de_relatorio', me.eventos_report
  ) INTO v_result
  FROM metricas_vendas mv
  CROSS JOIN metricas_eventos me
  CROSS JOIN cmv_periodo cmv
  CROSS JOIN despesas_banco db
  CROSS JOIN despesas_manuais dm;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 6. Comentário explicativo
COMMENT ON FUNCTION public.get_vendas_por_pedido IS 'RPC para listar vendas por pedido. Prioriza eventos de origem=report sobre origem=api para custos/taxas.';