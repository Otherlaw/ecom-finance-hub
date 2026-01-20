
-- =====================================================
-- FIX: Restaurar RPCs de Vendas com Lógica Correta
-- =====================================================
-- A migration anterior (20260120063422) removeu overloads mas
-- substituiu a lógica por código com colunas inexistentes.
-- Esta migration restaura a lógica que funcionava.
-- =====================================================

-- DROP de TODAS as versões conhecidas
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date);

-- =====================================================
-- 1. get_vendas_por_pedido_resumo - ÚNICA VERSÃO
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  total_pedidos bigint,
  total_itens numeric,
  valor_produto_total numeric,
  valor_liquido_total numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  -- Converter datas para timestamptz no fuso de Brasília
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
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  pedidos_com_itens AS (
    SELECT 
      pb.*,
      COALESCE((
        SELECT SUM(COALESCE(mti.quantidade, 1))
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pb.transaction_id
      ), 1) as qtd_itens,
      COALESCE((
        SELECT SUM(
          COALESCE(mti.quantidade, 1) * COALESCE(
            (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id),
            (SELECT sm.custo_unitario FROM sku_marketplace_mappings sm 
             WHERE sm.sku_marketplace = mti.sku_marketplace 
             AND sm.empresa_id = pb.empresa_id LIMIT 1),
            0
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pb.transaction_id
      ), 0) as cmv_calculado
    FROM pedidos_base pb
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) as comissao_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira', 'tarifa_frete_gratis') THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) as frete_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) as ads_evt
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IN (SELECT pedido_id FROM pedidos_base)
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
    GROUP BY fe.pedido_id
  )
  SELECT
    COUNT(*)::bigint as total_pedidos,
    COALESCE(SUM(pci.qtd_itens), 0)::numeric as total_itens,
    COALESCE(SUM(pci.valor_bruto), 0)::numeric as valor_produto_total,
    COALESCE(SUM(pci.valor_liquido), 0)::numeric as valor_liquido_total,
    -- Usar eventos se existirem, senão usar taxas da transação
    COALESCE(SUM(COALESCE(NULLIF(ep.comissao_evt, 0), pci.taxas)), 0)::numeric as comissao_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.tarifa_evt, 0), pci.tarifas)), 0)::numeric as tarifa_fixa_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.frete_evt, 0), pci.frete_vendedor)), 0)::numeric as frete_vendedor_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.ads_evt, 0), pci.custo_ads)), 0)::numeric as ads_total,
    -- Impostos estimados a 6%
    ROUND(COALESCE(SUM(pci.valor_bruto), 0) * 0.06, 2)::numeric as impostos_total,
    COALESCE(SUM(pci.cmv_calculado), 0)::numeric as cmv_total,
    -- Margem de contribuição
    (COALESCE(SUM(pci.valor_bruto), 0) 
     - COALESCE(SUM(COALESCE(NULLIF(ep.comissao_evt, 0), pci.taxas)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.tarifa_evt, 0), pci.tarifas)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.frete_evt, 0), pci.frete_vendedor)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.ads_evt, 0), pci.custo_ads)), 0)
     - ROUND(COALESCE(SUM(pci.valor_bruto), 0) * 0.06, 2)
     - COALESCE(SUM(pci.cmv_calculado), 0)
    )::numeric as margem_contribuicao_total
  FROM pedidos_com_itens pci
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pci.pedido_id;
END;
$function$;

-- =====================================================
-- 2. get_vendas_por_pedido_count - ÚNICA VERSÃO
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_count bigint;
BEGIN
  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT COUNT(DISTINCT mt.pedido_id)
  INTO v_count
  FROM marketplace_transactions mt
  WHERE mt.pedido_id IS NOT NULL
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= v_start_ts
    AND mt.data_transacao < v_end_ts
    AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
    AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
    AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%');

  RETURN v_count;
END;
$function$;

-- =====================================================
-- 3. get_vendas_por_pedido - ÚNICA VERSÃO (data_repasse DATE)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE,
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
  status_transacao text,
  data_transacao timestamptz,
  data_repasse date,
  valor_produto numeric,
  valor_liquido numeric,
  comissao numeric,
  tarifa_fixa numeric,
  frete_vendedor numeric,
  custo_ads numeric,
  imposto_calculado numeric,
  qtd_itens numeric,
  cmv_total numeric,
  tem_cmv boolean,
  margem_contribuicao numeric,
  status_enriquecimento text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

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
      mt.status_enriquecimento
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    ORDER BY mt.pedido_id, mt.data_transacao DESC
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
            (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id),
            (SELECT sm.custo_unitario FROM sku_marketplace_mappings sm 
             WHERE sm.sku_marketplace = mti.sku_marketplace 
             AND sm.empresa_id = pa.empresa_id LIMIT 1),
            0
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), 0) as cmv_calculado,
      COALESCE((
        SELECT bool_and(
          mti.produto_id IS NOT NULL 
          OR EXISTS(
            SELECT 1 FROM sku_marketplace_mappings sm 
            WHERE sm.sku_marketplace = mti.sku_marketplace 
            AND sm.empresa_id = pa.empresa_id
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), false) as tem_cmv_calc
    FROM pedidos_agregados pa
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) as comissao_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira', 'tarifa_frete_gratis') THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) as frete_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) as ads_evt
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IN (SELECT pcc.pedido_id FROM pedidos_com_calculo pcc)
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
    GROUP BY fe.pedido_id
  )
  SELECT
    pcc.pedido_id::text,
    pcc.empresa_id,
    pcc.canal::text,
    pcc.conta_nome::text,
    pcc.status::text as status_transacao,
    pcc.data_transacao,
    pcc.data_repasse::date,
    pcc.valor_bruto::numeric as valor_produto,
    pcc.valor_liquido::numeric,
    COALESCE(NULLIF(ep.comissao_evt, 0), pcc.taxas)::numeric as comissao,
    COALESCE(NULLIF(ep.tarifa_evt, 0), pcc.tarifas)::numeric as tarifa_fixa,
    COALESCE(NULLIF(ep.frete_evt, 0), pcc.frete_vend)::numeric as frete_vendedor,
    COALESCE(NULLIF(ep.ads_evt, 0), pcc.ads)::numeric as custo_ads,
    ROUND(pcc.valor_bruto * 0.06, 2)::numeric as imposto_calculado,
    pcc.qtd_itens_calc::numeric as qtd_itens,
    pcc.cmv_calculado::numeric as cmv_total,
    pcc.tem_cmv_calc as tem_cmv,
    CASE 
      WHEN pcc.tem_cmv_calc THEN
        (pcc.valor_bruto 
         - COALESCE(NULLIF(ep.comissao_evt, 0), pcc.taxas)
         - COALESCE(NULLIF(ep.tarifa_evt, 0), pcc.tarifas)
         - COALESCE(NULLIF(ep.frete_evt, 0), pcc.frete_vend)
         - COALESCE(NULLIF(ep.ads_evt, 0), pcc.ads)
         - ROUND(pcc.valor_bruto * 0.06, 2)
         - pcc.cmv_calculado
        )::numeric
      ELSE NULL
    END as margem_contribuicao,
    pcc.status_enriquecimento::text
  FROM pedidos_com_calculo pcc
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pcc.pedido_id
  ORDER BY pcc.data_transacao DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
