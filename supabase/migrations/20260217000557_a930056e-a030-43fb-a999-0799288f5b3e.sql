
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL
)
RETURNS TABLE (
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
SET search_path = public
AS $$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  -- Security check: if user has no empresas, return empty
  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;
  
  -- If specific empresa requested, verify access
  IF p_empresa_id IS NOT NULL AND NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  RETURN QUERY
  WITH vendas AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS group_key,
      mt.empresa_id,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.outros_descontos,
      mt.valor_liquido,
      mt.id AS tx_id
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
  ),
  itens_por_tx AS (
    SELECT
      mti.transaction_id,
      SUM(mti.quantidade) AS qtd,
      SUM(CASE WHEN p.custo_medio > 0 THEN mti.quantidade * p.custo_medio ELSE 0 END) AS cmv,
      BOOL_OR(p.custo_medio IS NOT NULL AND p.custo_medio > 0) AS has_cmv
    FROM marketplace_transaction_items mti
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mti.transaction_id IN (SELECT tx_id FROM vendas)
    GROUP BY mti.transaction_id
  ),
  agregado AS (
    SELECT
      v.group_key,
      v.empresa_id,
      SUM(COALESCE(v.valor_bruto, 0)) AS val_bruto,
      SUM(COALESCE(v.taxas, 0)) AS taxas_sum,
      SUM(COALESCE(v.tarifas, 0)) AS tarifas_sum,
      SUM(COALESCE(v.frete_vendedor, 0)) AS frete_v_sum,
      SUM(COALESCE(v.custo_ads, 0)) AS ads_sum,
      SUM(COALESCE(v.outros_descontos, 0)) AS desc_sum,
      SUM(COALESCE(v.valor_liquido, 0)) AS liq_sum,
      COALESCE(SUM(ipt.qtd), 0) AS qtd_sum,
      SUM(COALESCE(ipt.cmv, 0)) AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    GROUP BY v.group_key, v.empresa_id
  )
  SELECT
    COUNT(*)::bigint AS total_pedidos,
    SUM(a.qtd_sum) AS total_itens,
    SUM(a.val_bruto) AS valor_produto_total,
    SUM(a.taxas_sum) AS comissao_total,
    SUM(a.tarifas_sum) AS tarifa_fixa_total,
    SUM(a.frete_v_sum) AS frete_vendedor_total,
    SUM(a.ads_sum) AS ads_total,
    SUM(a.val_bruto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100) AS impostos_total,
    SUM(a.liq_sum) AS valor_liquido_total,
    SUM(a.cmv_sum) AS cmv_total,
    SUM(CASE WHEN a.has_cmv THEN a.liq_sum - a.cmv_sum - (a.val_bruto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100) ELSE 0 END) AS margem_contribuicao_total,
    COUNT(*) FILTER (WHERE a.has_cmv)::bigint AS pedidos_com_cmv,
    COUNT(*) FILTER (WHERE NOT a.has_cmv)::bigint AS pedidos_sem_cmv
  FROM agregado a
  LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = a.empresa_id;
END;
$$;
