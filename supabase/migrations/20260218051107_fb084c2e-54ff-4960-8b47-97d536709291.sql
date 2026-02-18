
-- Drop e recriar a função com novo schema de retorno
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo_v2(uuid, text, text);

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

  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  END IF;
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';
  END IF;

  RETURN QUERY
  WITH vendas AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id) AS group_key,
      mt.empresa_id,
      mt.tipo_envio,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.outros_descontos,
      mt.valor_liquido,
      COALESCE(mt.rebate, 0) AS rebate,
      COALESCE(mt.bonus_envio, 0) AS bonus_envio,
      mt.id AS tx_id
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, COALESCE(ecf.aliquota_imposto_vendas, 6.0) AS aliquota_imposto
    FROM empresas_config_fiscal ecf
    WHERE ecf.empresa_id = ANY(v_user_empresa_ids)
  ),
  config_logistica AS (
    SELECT elc.empresa_id, COALESCE(elc.flex_custo, 0) AS flex_custo, COALESCE(elc.flex_turbo_custo, 0) AS flex_turbo_custo
    FROM empresa_logistica_config elc
    WHERE elc.empresa_id = ANY(v_user_empresa_ids)
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
      MAX(v.tipo_envio) AS tipo_envio,
      SUM(COALESCE(v.valor_bruto, 0)) AS val_bruto,
      SUM(COALESCE(v.taxas, 0)) AS taxas_sum,
      SUM(COALESCE(v.tarifas, 0)) AS tarifas_sum,
      SUM(COALESCE(v.frete_vendedor, 0)) AS frete_v_sum,
      SUM(COALESCE(v.custo_ads, 0)) AS ads_sum,
      SUM(COALESCE(v.outros_descontos, 0)) AS desc_sum,
      SUM(v.rebate) AS rebate_sum,
      SUM(v.bonus_envio) AS bonus_envio_sum,
      COALESCE(SUM(ipt.qtd), 0) AS qtd_sum,
      SUM(COALESCE(ipt.cmv, 0)) AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    GROUP BY v.group_key, v.empresa_id
  )
  SELECT
    COUNT(*)::bigint,
    SUM(a.qtd_sum),
    SUM(a.val_bruto),
    SUM(a.taxas_sum),
    SUM(a.tarifas_sum),
    SUM(a.frete_v_sum),
    SUM(a.ads_sum),
    SUM(ROUND(a.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)),
    SUM(
      a.val_bruto - a.taxas_sum - a.tarifas_sum - a.frete_v_sum
      + a.rebate_sum + a.bonus_envio_sum - a.desc_sum
      - ROUND(a.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
      - CASE WHEN a.tipo_envio = 'flex_turbo' THEN COALESCE(cl.flex_turbo_custo, 0)
             WHEN a.tipo_envio = 'flex' THEN COALESCE(cl.flex_custo, 0)
             ELSE 0 END
    ),
    SUM(a.cmv_sum),
    SUM(CASE WHEN a.has_cmv THEN
      a.val_bruto - a.taxas_sum - a.tarifas_sum - a.frete_v_sum
      + a.rebate_sum + a.bonus_envio_sum - a.desc_sum
      - ROUND(a.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
      - CASE WHEN a.tipo_envio = 'flex_turbo' THEN COALESCE(cl.flex_turbo_custo, 0)
             WHEN a.tipo_envio = 'flex' THEN COALESCE(cl.flex_custo, 0)
             ELSE 0 END
      - a.cmv_sum
    ELSE 0 END),
    COUNT(*) FILTER (WHERE a.has_cmv)::bigint,
    COUNT(*) FILTER (WHERE NOT a.has_cmv)::bigint
  FROM agregado a
  LEFT JOIN config_fiscal cf ON cf.empresa_id = a.empresa_id
  LEFT JOIN config_logistica cl ON cl.empresa_id = a.empresa_id;
END;
$$;
