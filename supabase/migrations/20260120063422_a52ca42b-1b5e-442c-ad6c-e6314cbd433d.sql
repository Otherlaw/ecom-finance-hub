-- ============================================
-- FIX: Remover TODAS as versões das funções e recriar corretamente
-- ============================================

-- 1. DROP de TODAS as versões conhecidas das funções (forçar)
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, text, text, text, text, text);

DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date);

DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date);

-- 2. Recriar get_vendas_por_pedido_resumo ÚNICA
CREATE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - INTERVAL '30 days',
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
SET search_path = public
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT ON (t.pedido_id)
      t.pedido_id,
      t.empresa_id,
      t.valor_produto,
      t.valor_liquido,
      t.comissao,
      t.tarifa_fixa,
      t.tarifa_frete_gratis,
      t.tarifa_financiamento,
      t.frete_vendedor,
      t.custo_ads,
      t.imposto_calculado,
      (SELECT COALESCE(SUM(COALESCE(i.quantidade, 1)), 1)
       FROM marketplace_transaction_items i
       WHERE i.transaction_id = t.id) as qtd_itens,
      (SELECT COALESCE(SUM(
        COALESCE(i.quantidade, 1) * COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = i.produto_id),
          (SELECT sm.custo_unitario FROM sku_marketplace_mappings sm WHERE sm.sku_marketplace = i.sku_marketplace AND sm.empresa_id = t.empresa_id LIMIT 1),
          0
        )
      ), 0)
      FROM marketplace_transaction_items i
      WHERE i.transaction_id = t.id) as cmv_calculado
    FROM marketplace_transactions t
    WHERE t.pedido_id IS NOT NULL
      AND t.tipo_lancamento = 'credito'
      AND t.data_transacao >= v_start_ts
      AND t.data_transacao < v_end_ts
      AND (p_empresa_id IS NULL OR t.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR t.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR t.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR t.status_transacao ILIKE '%' || p_status || '%')
    ORDER BY t.pedido_id, t.data_transacao DESC
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(pb.qtd_itens), 0)::numeric,
    COALESCE(SUM(pb.valor_produto), 0)::numeric,
    COALESCE(SUM(pb.valor_liquido), 0)::numeric,
    COALESCE(SUM(pb.comissao), 0)::numeric,
    COALESCE(SUM(COALESCE(pb.tarifa_fixa, 0) + COALESCE(pb.tarifa_frete_gratis, 0) + COALESCE(pb.tarifa_financiamento, 0)), 0)::numeric,
    COALESCE(SUM(pb.frete_vendedor), 0)::numeric,
    COALESCE(SUM(pb.custo_ads), 0)::numeric,
    COALESCE(SUM(pb.imposto_calculado), 0)::numeric,
    COALESCE(SUM(pb.cmv_calculado), 0)::numeric,
    COALESCE(SUM(
      pb.valor_produto 
      - COALESCE(pb.comissao, 0)
      - COALESCE(pb.tarifa_fixa, 0) - COALESCE(pb.tarifa_frete_gratis, 0) - COALESCE(pb.tarifa_financiamento, 0)
      - COALESCE(pb.frete_vendedor, 0)
      - COALESCE(pb.custo_ads, 0)
      - COALESCE(pb.imposto_calculado, 0)
      - pb.cmv_calculado
    ), 0)::numeric
  FROM pedidos_base pb;
END;
$$;

-- 3. Recriar get_vendas_por_pedido_count ÚNICA
CREATE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_count bigint;
BEGIN
  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT COUNT(DISTINCT t.pedido_id)
  INTO v_count
  FROM marketplace_transactions t
  WHERE t.pedido_id IS NOT NULL
    AND t.tipo_lancamento = 'credito'
    AND t.data_transacao >= v_start_ts
    AND t.data_transacao < v_end_ts
    AND (p_empresa_id IS NULL OR t.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR t.canal ILIKE '%' || p_canal || '%')
    AND (p_conta IS NULL OR t.conta_nome ILIKE '%' || p_conta || '%')
    AND (p_status IS NULL OR t.status_transacao ILIKE '%' || p_status || '%');

  RETURN v_count;
END;
$$;

-- 4. Recriar get_vendas_por_pedido ÚNICA (data_repasse como DATE)
CREATE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - INTERVAL '30 days',
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
SET search_path = public
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_agregados AS (
    SELECT DISTINCT ON (t.pedido_id)
      t.pedido_id,
      t.empresa_id,
      t.canal,
      t.conta_nome,
      t.status_transacao,
      t.data_transacao,
      t.data_repasse,
      t.valor_produto,
      t.valor_liquido,
      t.comissao,
      COALESCE(t.tarifa_fixa, 0) + COALESCE(t.tarifa_frete_gratis, 0) + COALESCE(t.tarifa_financiamento, 0) as tarifa_fixa,
      t.frete_vendedor,
      t.custo_ads,
      t.imposto_calculado,
      t.status_enriquecimento,
      (SELECT COALESCE(SUM(COALESCE(i.quantidade, 1)), 1)
       FROM marketplace_transaction_items i
       WHERE i.transaction_id = t.id) as qtd_itens,
      (SELECT COALESCE(SUM(
        COALESCE(i.quantidade, 1) * COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = i.produto_id),
          (SELECT sm.custo_unitario FROM sku_marketplace_mappings sm WHERE sm.sku_marketplace = i.sku_marketplace AND sm.empresa_id = t.empresa_id LIMIT 1),
          0
        )
      ), 0)
      FROM marketplace_transaction_items i
      WHERE i.transaction_id = t.id) as cmv_calculado,
      (SELECT bool_and(i.produto_id IS NOT NULL OR EXISTS(
        SELECT 1 FROM sku_marketplace_mappings sm 
        WHERE sm.sku_marketplace = i.sku_marketplace AND sm.empresa_id = t.empresa_id
      ))
      FROM marketplace_transaction_items i
      WHERE i.transaction_id = t.id) as tem_cmv_calc
    FROM marketplace_transactions t
    WHERE t.pedido_id IS NOT NULL
      AND t.tipo_lancamento = 'credito'
      AND t.data_transacao >= v_start_ts
      AND t.data_transacao < v_end_ts
      AND (p_empresa_id IS NULL OR t.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR t.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR t.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR t.status_transacao ILIKE '%' || p_status || '%')
    ORDER BY t.pedido_id, t.data_transacao DESC
  )
  SELECT
    pa.pedido_id,
    pa.empresa_id,
    pa.canal,
    pa.conta_nome,
    pa.status_transacao,
    pa.data_transacao,
    pa.data_repasse,
    pa.valor_produto,
    pa.valor_liquido,
    pa.comissao,
    pa.tarifa_fixa,
    pa.frete_vendedor,
    pa.custo_ads,
    pa.imposto_calculado,
    pa.qtd_itens,
    pa.cmv_calculado as cmv_total,
    COALESCE(pa.tem_cmv_calc, false) as tem_cmv,
    CASE 
      WHEN COALESCE(pa.tem_cmv_calc, false) THEN
        pa.valor_produto 
        - COALESCE(pa.comissao, 0)
        - pa.tarifa_fixa
        - COALESCE(pa.frete_vendedor, 0)
        - COALESCE(pa.custo_ads, 0)
        - COALESCE(pa.imposto_calculado, 0)
        - pa.cmv_calculado
      ELSE NULL
    END as margem_contribuicao,
    pa.status_enriquecimento
  FROM pedidos_agregados pa
  ORDER BY pa.data_transacao DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_vendas_por_pedido_resumo(uuid, date, date, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vendas_por_pedido_count(uuid, date, date, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer) TO authenticated, anon;