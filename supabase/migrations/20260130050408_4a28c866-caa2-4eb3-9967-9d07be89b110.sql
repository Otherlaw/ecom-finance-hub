-- ============================================
-- CORREÇÃO DE RPCS - DROP FIRST E RECRIAÇÃO
-- ============================================

-- Drop das funções existentes que precisam mudar assinatura
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date, text, text, text);

-- 1) CRIAR RPC get_vendas_por_tipo_envio_dashboard (para Dashboard consolidado)
CREATE OR REPLACE FUNCTION public.get_vendas_por_tipo_envio_dashboard(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  tipo_envio text, 
  qtd_pedidos bigint, 
  qtd_itens numeric, 
  valor_bruto numeric, 
  valor_liquido numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  cmv_total numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_empresa_ids uuid[];
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  IF array_length(v_user_empresa_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN;
    END IF;
  END IF;

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      COALESCE(NULLIF(LOWER(mt.tipo_envio), ''), 'não classificado') as tipo_envio_norm,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
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
  itens_pedido AS (
    SELECT 
      pb.pedido_id,
      pb.tipo_envio_norm,
      COALESCE(SUM(mti.quantidade), 1) as qtd_itens_calc,
      COALESCE(SUM(
        mti.quantidade * COALESCE(
          NULLIF(p_by_id.custo_medio, 0),
          NULLIF(p_by_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0),
          0
        )
      ), 0) as cmv_calc
    FROM pedidos_base pb
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = pb.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = pb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = pb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
      AND COALESCE(p_by_sku.custo_medio, 0) = 0
    GROUP BY pb.pedido_id, pb.tipo_envio_norm
  ),
  eventos_priorizado AS (
    SELECT 
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor,
      ROW_NUMBER() OVER (
        PARTITION BY fe.pedido_id, fe.tipo_evento 
        ORDER BY CASE WHEN fe.origem = 'report' THEN 1 ELSE 2 END
      ) AS rn
    FROM marketplace_financial_events fe
    WHERE fe.data_evento >= v_start_ts
      AND fe.data_evento < v_end_ts
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN fe.empresa_id = p_empresa_id
          ELSE fe.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  eventos_pedido AS (
    SELECT
      ep.pedido_id,
      COALESCE(SUM(CASE WHEN ep.tipo_evento = 'comissao' THEN ABS(ep.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN ep.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(ep.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN ep.tipo_evento = 'frete_vendedor' THEN ABS(ep.valor) ELSE 0 END), 0) as frete_vend,
      COALESCE(SUM(CASE WHEN ep.tipo_evento = 'ads' THEN ABS(ep.valor) ELSE 0 END), 0) as ads
    FROM eventos_priorizado ep
    WHERE ep.rn = 1
    GROUP BY ep.pedido_id
  )
  SELECT
    ip.tipo_envio_norm as tipo_envio,
    COUNT(DISTINCT pb.pedido_id)::bigint as qtd_pedidos,
    SUM(ip.qtd_itens_calc)::numeric as qtd_itens,
    SUM(pb.valor_bruto)::numeric as valor_bruto,
    SUM(pb.valor_liquido)::numeric as valor_liquido,
    SUM(COALESCE(NULLIF(ep.comissao, 0), pb.taxas))::numeric as comissao_total,
    SUM(COALESCE(NULLIF(ep.tarifa_fixa, 0), pb.tarifas))::numeric as tarifa_fixa_total,
    SUM(COALESCE(NULLIF(ep.frete_vend, 0), pb.frete_vendedor))::numeric as frete_vendedor_total,
    SUM(COALESCE(NULLIF(ep.ads, 0), pb.custo_ads))::numeric as ads_total,
    SUM(ip.cmv_calc)::numeric as cmv_total
  FROM pedidos_base pb
  JOIN itens_pedido ip ON ip.pedido_id = pb.pedido_id
  LEFT JOIN eventos_pedido ep ON ep.pedido_id = pb.pedido_id
  GROUP BY ip.tipo_envio_norm;
END;
$$;

-- 2) CRIAR get_vendas_por_pedido COM BUSCA
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL::uuid, 
  p_data_inicio date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, 
  p_data_fim date DEFAULT CURRENT_DATE, 
  p_canal text DEFAULT NULL::text, 
  p_conta text DEFAULT NULL::text, 
  p_status text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text,
  p_limit integer DEFAULT 50, 
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text, 
  empresa_id uuid, 
  canal text, 
  conta_nome text, 
  status text, 
  data_pedido timestamp with time zone, 
  data_repasse date, 
  valor_produto numeric, 
  valor_liquido_calculado numeric, 
  comissao_total numeric, 
  tarifa_fixa_total numeric, 
  frete_vendedor_total numeric, 
  ads_total numeric, 
  impostos_total numeric, 
  outros_descontos_total numeric, 
  qtd_itens numeric, 
  cmv_total numeric, 
  tem_cmv boolean, 
  margem_contribuicao numeric, 
  tipo_envio text, 
  status_enriquecimento text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
  v_busca_pattern text;
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

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_busca_pattern := CASE WHEN p_busca IS NOT NULL AND p_busca != '' THEN '%' || LOWER(p_busca) || '%' ELSE NULL END;

  RETURN QUERY
  WITH pedidos_agregados AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      mt.status,
      mt.data_transacao,
      mt.data_repasse,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor as frete_vend,
      mt.custo_ads as ads,
      mt.outros_descontos,
      mt.tipo_envio,
      mt.status_enriquecimento
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
      AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  pedidos_filtrados AS (
    SELECT pa.*
    FROM pedidos_agregados pa
    WHERE v_busca_pattern IS NULL 
      OR LOWER(pa.pedido_id) LIKE v_busca_pattern
      OR EXISTS (
        SELECT 1 FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
          AND (
            LOWER(mti.sku_marketplace) LIKE v_busca_pattern
            OR LOWER(mti.descricao_item) LIKE v_busca_pattern
          )
      )
  ),
  pedidos_com_calculo AS (
    SELECT 
      pa.*,
      COALESCE((
        SELECT SUM(COALESCE(mti.quantidade, 1))
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), 1) as qtd_itens_calc,
      COALESCE((
        SELECT SUM(
          COALESCE(mti.quantidade, 1) * COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pa.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pa.empresa_id LIMIT 1), 0),
            0
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), 0) as cmv_calculado,
      COALESCE((
        SELECT bool_and(
          COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pa.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pa.empresa_id LIMIT 1), 0)
          ) IS NOT NULL
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), false) as tem_cmv_calc
    FROM pedidos_filtrados pa
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as ads_evt
    FROM (
      SELECT 
        mfe.pedido_id, mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (PARTITION BY mfe.pedido_id, mfe.tipo_evento ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END) as rn
      FROM marketplace_financial_events mfe
      WHERE mfe.pedido_id IN (SELECT pc.pedido_id FROM pedidos_com_calculo pc)
    ) fe
    GROUP BY fe.pedido_id
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
  )
  SELECT
    pc.pedido_id::text,
    pc.empresa_id,
    pc.canal::text,
    pc.conta_nome::text,
    pc.status::text,
    pc.data_transacao as data_pedido,
    pc.data_repasse,
    pc.valor_bruto as valor_produto,
    pc.valor_liquido as valor_liquido_calculado,
    COALESCE(NULLIF(ep.comissao_evt, 0), pc.taxas)::numeric as comissao_total,
    COALESCE(NULLIF(ep.tarifa_fixa_evt, 0), pc.tarifas)::numeric as tarifa_fixa_total,
    COALESCE(NULLIF(ep.frete_evt, 0), pc.frete_vend)::numeric as frete_vendedor_total,
    COALESCE(NULLIF(ep.ads_evt, 0), pc.ads)::numeric as ads_total,
    ROUND((pc.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2)::numeric as impostos_total,
    COALESCE(pc.outros_descontos, 0)::numeric as outros_descontos_total,
    pc.qtd_itens_calc::numeric as qtd_itens,
    CASE WHEN pc.cmv_calculado > 0 THEN pc.cmv_calculado ELSE NULL END::numeric as cmv_total,
    pc.tem_cmv_calc as tem_cmv,
    CASE WHEN pc.cmv_calculado > 0 THEN
      pc.valor_bruto 
      - COALESCE(NULLIF(ep.comissao_evt, 0), pc.taxas)
      - COALESCE(NULLIF(ep.tarifa_fixa_evt, 0), pc.tarifas)
      - COALESCE(NULLIF(ep.frete_evt, 0), pc.frete_vend)
      - COALESCE(NULLIF(ep.ads_evt, 0), pc.ads)
      - ROUND((pc.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2)
      - pc.cmv_calculado
    ELSE NULL END::numeric as margem_contribuicao,
    COALESCE(pc.tipo_envio, 'não classificado')::text as tipo_envio,
    pc.status_enriquecimento::text
  FROM pedidos_com_calculo pc
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pc.pedido_id
  LEFT JOIN config_fiscal cf ON cf.empresa_id = pc.empresa_id
  ORDER BY pc.data_transacao DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3) CRIAR get_vendas_por_pedido_count com busca
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL::uuid, 
  p_data_inicio date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, 
  p_data_fim date DEFAULT CURRENT_DATE, 
  p_canal text DEFAULT NULL::text, 
  p_conta text DEFAULT NULL::text, 
  p_status text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
  v_busca_pattern text;
  v_count bigint;
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN 0;
    END IF;
  END IF;
  
  IF array_length(v_user_empresa_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_busca_pattern := CASE WHEN p_busca IS NOT NULL AND p_busca != '' THEN '%' || LOWER(p_busca) || '%' ELSE NULL END;

  SELECT COUNT(DISTINCT mt.pedido_id) INTO v_count
  FROM marketplace_transactions mt
  WHERE mt.pedido_id IS NOT NULL
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= v_start_ts
    AND mt.data_transacao < v_end_ts
    AND (
      CASE 
        WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
        ELSE mt.empresa_id = ANY(v_user_empresa_ids)
      END
    )
    AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
    AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
    AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    AND (v_busca_pattern IS NULL OR LOWER(mt.pedido_id) LIKE v_busca_pattern
      OR EXISTS (
        SELECT 1 FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = mt.id
          AND (LOWER(mti.sku_marketplace) LIKE v_busca_pattern OR LOWER(mti.descricao_item) LIKE v_busca_pattern)
      )
    );

  RETURN v_count;
END;
$$;

-- 4) CRIAR get_vendas_por_pedido_resumo
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL::uuid, 
  p_data_inicio date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, 
  p_data_fim date DEFAULT CURRENT_DATE
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

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
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
  itens_por_pedido AS (
    SELECT 
      pb.pedido_id,
      COALESCE(SUM(COALESCE(mti.quantidade, 1)), 1) as qtd_itens,
      COALESCE(SUM(
        COALESCE(mti.quantidade, 1) * COALESCE(
          NULLIF(p_by_id.custo_medio, 0),
          NULLIF(p_by_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0),
          0
        )
      ), 0) as cmv_calc,
      BOOL_AND(
        COALESCE(
          NULLIF(p_by_id.custo_medio, 0),
          NULLIF(p_by_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0)
        ) IS NOT NULL
      ) as tem_cmv
    FROM pedidos_base pb
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = pb.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = pb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = pb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
      AND COALESCE(p_by_sku.custo_medio, 0) = 0
    GROUP BY pb.pedido_id
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_vend,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as ads
    FROM (
      SELECT 
        mfe.pedido_id, mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (PARTITION BY mfe.pedido_id, mfe.tipo_evento ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END) as rn
      FROM marketplace_financial_events mfe
      WHERE mfe.pedido_id IN (SELECT pb2.pedido_id FROM pedidos_base pb2)
    ) fe
    GROUP BY fe.pedido_id
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
  )
  SELECT
    COUNT(DISTINCT pb.pedido_id)::bigint as total_pedidos,
    COALESCE(SUM(ip.qtd_itens), 0)::numeric as total_itens,
    COALESCE(SUM(pb.valor_bruto), 0)::numeric as valor_produto_total,
    COALESCE(SUM(COALESCE(NULLIF(epp.comissao, 0), pb.taxas)), 0)::numeric as comissao_total,
    COALESCE(SUM(COALESCE(NULLIF(epp.tarifa_fixa, 0), pb.tarifas)), 0)::numeric as tarifa_fixa_total,
    COALESCE(SUM(COALESCE(NULLIF(epp.frete_vend, 0), pb.frete_vendedor)), 0)::numeric as frete_vendedor_total,
    COALESCE(SUM(COALESCE(NULLIF(epp.ads, 0), pb.custo_ads)), 0)::numeric as ads_total,
    COALESCE(SUM(ROUND((pb.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2)), 0)::numeric as impostos_total,
    COALESCE(SUM(pb.valor_liquido), 0)::numeric as valor_liquido_total,
    COALESCE(SUM(ip.cmv_calc), 0)::numeric as cmv_total,
    COALESCE(SUM(
      CASE WHEN ip.cmv_calc > 0 THEN
        pb.valor_bruto 
        - COALESCE(NULLIF(epp.comissao, 0), pb.taxas)
        - COALESCE(NULLIF(epp.tarifa_fixa, 0), pb.tarifas)
        - COALESCE(NULLIF(epp.frete_vend, 0), pb.frete_vendedor)
        - COALESCE(NULLIF(epp.ads, 0), pb.custo_ads)
        - ROUND((pb.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2)
        - ip.cmv_calc
      ELSE 0 END
    ), 0)::numeric as margem_contribuicao_total,
    COUNT(DISTINCT CASE WHEN ip.tem_cmv THEN pb.pedido_id END)::bigint as pedidos_com_cmv,
    COUNT(DISTINCT CASE WHEN NOT ip.tem_cmv OR ip.tem_cmv IS NULL THEN pb.pedido_id END)::bigint as pedidos_sem_cmv
  FROM pedidos_base pb
  LEFT JOIN itens_por_pedido ip ON ip.pedido_id = pb.pedido_id
  LEFT JOIN eventos_por_pedido epp ON epp.pedido_id = pb.pedido_id
  LEFT JOIN config_fiscal cf ON cf.empresa_id = pb.empresa_id;
END;
$$;