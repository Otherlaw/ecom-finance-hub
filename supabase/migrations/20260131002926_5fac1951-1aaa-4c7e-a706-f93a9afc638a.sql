
-- Reaplicar com a MESMA assinatura (defaults) existente.

CREATE OR REPLACE FUNCTION public.get_vendas_resumo_por_tipo_envio(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio date DEFAULT (CURRENT_DATE - 30),
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  tipo_envio text,
  qtd_transacoes bigint,
  qtd_itens numeric,
  valor_bruto numeric,
  valor_liquido numeric,
  tarifas numeric,
  taxas numeric,
  frete_comprador numeric,
  frete_vendedor numeric,
  custo_ads numeric,
  cmv_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();

  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN;
    END IF;
  END IF;

  IF array_length(v_user_empresa_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_start_ts := public.date_to_br_timestamptz(p_data_inicio);
  v_end_ts := public.date_to_br_timestamptz(p_data_fim + 1);

  RETURN QUERY
  WITH transacoes_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.id as transaction_id,
      mt.empresa_id,
      mt.pedido_id,
      COALESCE(LOWER(mt.tipo_envio), 'outros') as tipo_envio_norm,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.tarifas,
      mt.taxas,
      mt.frete_comprador,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.raw_order
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  itens_fisicos AS (
    SELECT
      tb.transaction_id,
      tb.empresa_id,
      tb.tipo_envio_norm,
      COALESCE(mti.quantidade, 0)::numeric AS quantidade,
      (COALESCE(mti.quantidade, 0) * COALESCE(
        (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
        (SELECT p.custo_medio FROM produto_marketplace_map pmm
         JOIN produtos p ON p.id = pmm.produto_id
         WHERE pmm.sku_marketplace = mti.sku_marketplace
           AND pmm.empresa_id = tb.empresa_id
           AND pmm.ativo = true
           AND COALESCE(p.custo_medio,0) > 0
         LIMIT 1),
        (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = tb.empresa_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
        (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = tb.empresa_id LIMIT 1),
        0
      ))::numeric AS cmv_item
    FROM transacoes_base tb
    JOIN marketplace_transaction_items mti ON mti.transaction_id = tb.transaction_id
  ),
  itens_raw AS (
    SELECT
      tb.transaction_id,
      tb.empresa_id,
      tb.tipo_envio_norm,
      COALESCE((oi->>'quantity')::int, 1)::numeric AS quantidade,
      (
        COALESCE((oi->>'quantity')::int, 1)
        * COALESCE(
          (SELECT p.custo_medio
           FROM produto_marketplace_map pmm
           JOIN produtos p ON p.id = pmm.produto_id
           WHERE pmm.sku_marketplace = COALESCE(
             oi->>'seller_custom_field',
             oi->>'seller_sku',
             oi->'item'->>'seller_custom_field',
             oi->'item'->>'seller_sku'
           )
             AND pmm.empresa_id = tb.empresa_id
             AND pmm.ativo = true
           LIMIT 1),
          0
        )
      )::numeric AS cmv_item
    FROM transacoes_base tb
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN tb.raw_order->'order_items' IS NOT NULL THEN tb.raw_order->'order_items'
        WHEN tb.raw_order->'items' IS NOT NULL THEN tb.raw_order->'items'
        ELSE '[]'::jsonb
      END
    ) AS oi
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_transaction_items mti WHERE mti.transaction_id = tb.transaction_id
    )
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_vend
    FROM (
      SELECT
        mfe.pedido_id, mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (
          PARTITION BY mfe.pedido_id, mfe.tipo_evento
          ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END
        ) as rn
      FROM marketplace_financial_events mfe
      WHERE mfe.pedido_id IN (SELECT tb2.pedido_id FROM transacoes_base tb2)
    ) fe
    GROUP BY fe.pedido_id
  ),
  itens_union AS (
    SELECT transaction_id, tipo_envio_norm, quantidade, cmv_item FROM itens_fisicos
    UNION ALL
    SELECT transaction_id, tipo_envio_norm, quantidade, cmv_item FROM itens_raw
  )
  SELECT
    tb.tipo_envio_norm as tipo_envio,
    COUNT(DISTINCT tb.pedido_id)::bigint as qtd_transacoes,
    COALESCE(SUM(iu.quantidade), 0)::numeric as qtd_itens,
    COALESCE(SUM(tb.valor_bruto), 0)::numeric as valor_bruto,
    COALESCE(SUM(tb.valor_liquido), 0)::numeric as valor_liquido,
    COALESCE(SUM(COALESCE(NULLIF(epp.tarifa_fixa, 0), tb.tarifas)), 0)::numeric as tarifas,
    COALESCE(SUM(COALESCE(NULLIF(epp.comissao, 0), tb.taxas)), 0)::numeric as taxas,
    COALESCE(SUM(tb.frete_comprador), 0)::numeric as frete_comprador,
    COALESCE(SUM(COALESCE(NULLIF(epp.frete_vend, 0), tb.frete_vendedor)), 0)::numeric as frete_vendedor,
    COALESCE(SUM(tb.custo_ads), 0)::numeric as custo_ads,
    COALESCE(SUM(iu.cmv_item), 0)::numeric as cmv_total
  FROM transacoes_base tb
  LEFT JOIN itens_union iu ON iu.transaction_id = tb.transaction_id
  LEFT JOIN eventos_por_pedido epp ON epp.pedido_id = tb.pedido_id
  GROUP BY tb.tipo_envio_norm
  ORDER BY valor_bruto DESC;
END;
$$;


-- Dashboard (KPIs do período): alinhar base de vendas + CMV com fallback
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
  vendas_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
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
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    ORDER BY mt.pedido_id, mt.data_transacao DESC
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
      vb.pedido_id,
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
    GROUP BY vb.pedido_id
  ),

  cmv_raw AS (
    SELECT
      vb.pedido_id,
      SUM(
        COALESCE(
          (SELECT p.custo_medio
           FROM produto_marketplace_map pmm
           JOIN produtos p ON p.id = pmm.produto_id
           WHERE pmm.sku_marketplace = COALESCE(
             oi->>'seller_custom_field',
             oi->>'seller_sku',
             oi->'item'->>'seller_custom_field',
             oi->'item'->>'seller_sku'
           )
             AND pmm.empresa_id = vb.empresa_id
             AND pmm.ativo = true
           LIMIT 1),
          0
        ) * COALESCE((oi->>'quantity')::int, 1)
      )::numeric AS cmv_total,
      COUNT(*)::bigint AS total_itens
    FROM vendas_base vb
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN vb.raw_order->'order_items' IS NOT NULL THEN vb.raw_order->'order_items'
        WHEN vb.raw_order->'items' IS NOT NULL THEN vb.raw_order->'items'
        ELSE '[]'::jsonb
      END
    ) AS oi
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_transaction_items mti WHERE mti.transaction_id = vb.id
    )
    GROUP BY vb.pedido_id
  ),

  cmv_periodo AS (
    SELECT
      COALESCE(SUM(COALESCE(ci.cmv_total, cr.cmv_total, 0)), 0)::numeric AS cmv_total,
      COALESCE(SUM(COALESCE(ci.itens_com_custo, 0)), 0)::bigint AS itens_com_custo,
      COALESCE(SUM(COALESCE(ci.total_itens, cr.total_itens, 0)), 0)::bigint AS total_itens
    FROM vendas_base vb
    LEFT JOIN cmv_itens ci ON ci.pedido_id = vb.pedido_id
    LEFT JOIN cmv_raw cr ON cr.pedido_id = vb.pedido_id
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

  metricas_vendas AS (
    SELECT
      COALESCE(SUM(vb.valor_bruto), 0) AS faturamento_bruto,
      COALESCE(SUM(
        vb.valor_bruto
        - COALESCE(vb.taxas, 0)
        - COALESCE(vb.tarifas, 0)
        - COALESCE(vb.frete_vendedor, 0)
        - COALESCE(vb.custo_ads, 0)
      ), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(vb.taxas, 0)), 0) AS comissao_total_legado,
      COALESCE(SUM(COALESCE(vb.tarifas, 0)), 0) AS tarifa_fixa_total_legado,
      COALESCE(SUM(COALESCE(vb.frete_vendedor, 0)), 0) AS frete_vendedor_total,
      COALESCE(SUM(COALESCE(vb.frete_comprador, 0)), 0) AS frete_comprador_total,
      COALESCE(SUM(COALESCE(vb.custo_ads, 0)), 0) AS ads_total,
      COUNT(DISTINCT vb.pedido_id) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM vendas_base vb
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
      vb.canal,
      COALESCE(SUM(vb.valor_bruto), 0) AS bruto,
      COALESCE(SUM(
        vb.valor_bruto
        - COALESCE(vb.taxas, 0)
        - COALESCE(vb.tarifas, 0)
        - COALESCE(vb.frete_vendedor, 0)
        - COALESCE(vb.custo_ads, 0)
      ), 0) AS liquido,
      COUNT(DISTINCT vb.pedido_id) AS pedidos
    FROM vendas_base vb
    GROUP BY vb.canal
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
