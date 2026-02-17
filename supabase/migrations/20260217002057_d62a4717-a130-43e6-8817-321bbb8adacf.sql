
-- =============================================================================
-- Migration: Otimizar RPCs de Vendas + Alinhar Dashboard
-- 1) Criar get_vendas_por_pedido_resumo_v2 (sem JOIN pesado de CMV)
-- 2) Criar índice parcial otimizado
-- 3) Alinhar get_dashboard_kpis_period com COALESCE(pack_id, pedido_id, referencia_externa)
-- =============================================================================

-- ========================
-- PARTE 1: RPC de resumo otimizada (SEM cálculo de CMV por item)
-- ========================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo_v2(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio text DEFAULT NULL::text,
  p_data_fim text DEFAULT NULL::text
)
RETURNS TABLE(
  total_pedidos bigint,
  total_itens numeric,
  valor_produto_total numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  valor_liquido_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv bigint,
  pedidos_sem_cmv bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();

  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  IF p_empresa_id IS NOT NULL AND NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  RETURN QUERY
  WITH pedidos AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS gk,
      mt.empresa_id,
      SUM(COALESCE(mt.valor_bruto, 0)) AS bruto,
      SUM(COALESCE(mt.taxas, 0)) AS taxas_sum,
      SUM(COALESCE(mt.tarifas, 0)) AS tarifas_sum,
      SUM(COALESCE(mt.frete_vendedor, 0)) AS frete_v_sum,
      SUM(COALESCE(mt.custo_ads, 0)) AS ads_sum,
      SUM(COALESCE(mt.outros_descontos, 0)) AS desc_sum,
      SUM(COALESCE(mt.valor_liquido, 0)) AS liq_sum,
      COUNT(*) AS tx_count
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    GROUP BY gk, mt.empresa_id
  )
  SELECT
    COUNT(*)::bigint AS total_pedidos,
    SUM(p.tx_count)::numeric AS total_itens,
    SUM(p.bruto)::numeric AS valor_produto_total,
    SUM(p.taxas_sum)::numeric AS comissao_total,
    SUM(p.tarifas_sum)::numeric AS tarifa_fixa_total,
    SUM(p.frete_v_sum)::numeric AS frete_vendedor_total,
    SUM(p.ads_sum)::numeric AS ads_total,
    SUM(p.bruto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100)::numeric AS impostos_total,
    SUM(p.liq_sum)::numeric AS valor_liquido_total,
    0::numeric AS cmv_total,
    0::numeric AS margem_contribuicao_total,
    0::bigint AS pedidos_com_cmv,
    0::bigint AS pedidos_sem_cmv
  FROM pedidos p
  LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = p.empresa_id;
END;
$$;

COMMENT ON FUNCTION public.get_vendas_por_pedido_resumo_v2 IS 'Versão otimizada do resumo de vendas - sem cálculo de CMV pesado, para cards de métricas rápidas';

-- ========================
-- PARTE 2: Índice parcial otimizado para vendas
-- ========================
CREATE INDEX IF NOT EXISTS idx_mkt_tx_venda_credito_data
ON marketplace_transactions (data_transacao DESC, empresa_id)
INCLUDE (pack_id, pedido_id, referencia_externa, valor_bruto, taxas, tarifas, frete_vendedor, custo_ads, valor_liquido, outros_descontos, status, tipo_envio, conta_nome, canal)
WHERE tipo_transacao = 'venda' AND tipo_lancamento = 'credito';

-- ========================
-- PARTE 3: Alinhar Dashboard com Vendas (COALESCE pack_id)
-- ========================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_period(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();

  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN '{}'::jsonb;
    END IF;
  END IF;

  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;

  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  WITH
  -- ALINHADO: usar COALESCE(pack_id, pedido_id, referencia_externa) como em Vendas
  vendas_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS group_key,
      mt.id,
      mt.empresa_id,
      mt.canal,
      mt.pedido_id,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads,
      mt.raw_order
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),

  -- Agregar por group_key para contar pedidos como em Vendas
  vendas_agrupadas AS (
    SELECT
      vb.group_key,
      (ARRAY_AGG(vb.empresa_id))[1] AS empresa_id,
      SUM(COALESCE(vb.valor_bruto, 0)) AS valor_bruto,
      SUM(COALESCE(vb.taxas, 0)) AS taxas,
      SUM(COALESCE(vb.tarifas, 0)) AS tarifas,
      SUM(COALESCE(vb.frete_vendedor, 0)) AS frete_vendedor,
      SUM(COALESCE(vb.frete_comprador, 0)) AS frete_comprador,
      SUM(COALESCE(vb.custo_ads, 0)) AS custo_ads,
      (ARRAY_AGG(vb.canal))[1] AS canal
    FROM vendas_base vb
    GROUP BY vb.group_key
  ),

  eventos_financeiros AS (
    SELECT
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor,
      fe.origem,
      ROW_NUMBER() OVER (
        PARTITION BY fe.pedido_id, fe.tipo_evento
        ORDER BY CASE WHEN fe.origem = 'report' THEN 1 ELSE 2 END
      ) AS rn
    FROM marketplace_financial_events fe
    WHERE
      (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN fe.empresa_id = p_empresa_id
          ELSE fe.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  eventos_priorizados AS (
    SELECT pedido_id, tipo_evento, valor, origem
    FROM eventos_financeiros
    WHERE rn = 1
  ),

  cmv_itens AS (
    SELECT
      vb.id AS tx_id,
      SUM(
        COALESCE(mti.quantidade, 0) * COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produto_marketplace_map pmm
           JOIN produtos p ON p.id = pmm.produto_id
           WHERE pmm.sku_marketplace = mti.sku_marketplace
             AND pmm.empresa_id = vb.empresa_id
             AND pmm.ativo = true
             AND COALESCE(p.custo_medio,0) > 0
           LIMIT 1),
          (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = vb.empresa_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
          (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = vb.empresa_id LIMIT 1),
          0
        )
      )::numeric AS cmv_total,
      COUNT(DISTINCT CASE
        WHEN COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produto_marketplace_map pmm JOIN produtos p ON p.id = pmm.produto_id WHERE pmm.sku_marketplace = mti.sku_marketplace AND pmm.empresa_id = vb.empresa_id AND pmm.ativo = true AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = vb.empresa_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
          (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = vb.empresa_id LIMIT 1)
        ) > 0 THEN mti.id
      END) AS itens_com_custo,
      COUNT(DISTINCT mti.id) AS total_itens
    FROM vendas_base vb
    JOIN marketplace_transaction_items mti ON mti.transaction_id = vb.id
    GROUP BY vb.id
  ),

  cmv_periodo AS (
    SELECT
      COALESCE(SUM(ci.cmv_total), 0)::numeric AS cmv_total,
      COALESCE(SUM(ci.itens_com_custo), 0)::bigint AS itens_com_custo,
      COALESCE(SUM(ci.total_itens), 0)::bigint AS total_itens
    FROM cmv_itens ci
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
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN bt.empresa_id = p_empresa_id
          ELSE bt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
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
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),

  -- ALINHADO: métricas sobre pedidos agrupados (não transações individuais)
  metricas_vendas AS (
    SELECT
      COALESCE(SUM(va.valor_bruto), 0) AS faturamento_bruto,
      COALESCE(SUM(
        va.valor_bruto
        - va.taxas
        - va.tarifas
        - va.frete_vendedor
        - va.custo_ads
      ), 0) AS receita_liquida,
      COALESCE(SUM(va.taxas), 0) AS comissao_total_legado,
      COALESCE(SUM(va.tarifas), 0) AS tarifa_fixa_total_legado,
      COALESCE(SUM(va.frete_vendedor), 0) AS frete_vendedor_total,
      COALESCE(SUM(va.frete_comprador), 0) AS frete_comprador_total,
      COALESCE(SUM(va.custo_ads), 0) AS ads_total,
      COUNT(*) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM vendas_agrupadas va
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
      va.canal,
      COALESCE(SUM(va.valor_bruto), 0) AS bruto,
      COALESCE(SUM(
        va.valor_bruto - va.taxas - va.tarifas - va.frete_vendedor - va.custo_ads
      ), 0) AS liquido,
      COUNT(*) AS pedidos
    FROM vendas_agrupadas va
    GROUP BY va.canal
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

COMMENT ON FUNCTION public.get_dashboard_kpis_period IS 'KPIs do Dashboard alinhados com Vendas: usa COALESCE(pack_id, pedido_id, referencia_externa) para contagem de pedidos';
