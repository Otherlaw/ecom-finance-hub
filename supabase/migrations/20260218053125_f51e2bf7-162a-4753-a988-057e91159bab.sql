
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio text DEFAULT NULL::text,
  p_data_fim text DEFAULT NULL::text,
  p_canal text DEFAULT NULL::text,
  p_conta text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text,
  p_tipo_envio text DEFAULT NULL::text,
  p_tem_custo text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamp with time zone,
  data_repasse date,
  status text,
  tipo_envio text,
  valor_produto numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  outros_descontos_total numeric,
  rebate_total numeric,
  bonus_envio_total numeric,
  valor_liquido_calculado numeric,
  qtd_itens numeric,
  cmv_total numeric,
  margem_contribuicao numeric,
  tem_cmv boolean,
  primeiro_anuncio_id text,
  anuncio_ids text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_ids uuid[];
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
BEGIN
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id) INTO v_empresa_ids
    FROM user_empresas ue WHERE ue.user_id = auth.uid();
  END IF;

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN RETURN; END IF;

  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  END IF;
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';
  END IF;

  RETURN QUERY
  WITH vendas_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id) AS grp_pedido_id,
      mt.empresa_id,
      e.nome_fantasia,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      MAX(mt.status) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      SUM(COALESCE(mt.valor_bruto, 0)) AS valor_produto,
      CASE WHEN bool_and(mt.taxas IS NOT NULL) THEN SUM(COALESCE(mt.taxas, 0)) ELSE NULL END AS comissao_agg,
      CASE WHEN bool_and(mt.tarifas IS NOT NULL) THEN SUM(COALESCE(mt.tarifas, 0)) ELSE NULL END AS tarifa_fixa_agg,
      CASE WHEN bool_and(mt.frete_vendedor IS NOT NULL) THEN SUM(COALESCE(mt.frete_vendedor, 0)) ELSE NULL END AS frete_vendedor_agg,
      SUM(COALESCE(mt.custo_ads, 0)) AS ads_total,
      SUM(COALESCE(mt.rebate, 0)) AS rebate_agg,
      SUM(COALESCE(mt.bonus_envio, 0)) AS bonus_envio_agg,
      SUM(COALESCE(mt.outros_descontos, 0)) AS outros_descontos_agg
    FROM marketplace_transactions mt
    JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
      AND (p_canal IS NULL OR mt.canal ILIKE p_canal)
      AND (p_conta IS NULL OR mt.conta_nome ILIKE p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio = p_tipo_envio)
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, COALESCE(ecf.aliquota_imposto_vendas, 6.0) AS aliquota_imposto
    FROM empresas_config_fiscal ecf
  ),
  itens_agg AS (
    SELECT
      COALESCE(mt2.pack_id, mt2.pedido_id) AS grp_pedido_id,
      mt2.empresa_id,
      SUM(mti.quantidade) AS qtd_itens,
      -- CORREÇÃO: prioriza produtos.custo_medio, fallback sku_costs.custo_unitario
      CASE
        WHEN bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0)
        THEN SUM(mti.quantidade * COALESCE(NULLIF(p.custo_medio, 0), NULLIF(sc.custo_unitario, 0)))
        ELSE NULL
      END AS cmv_total,
      bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0) AS tem_cmv,
      (array_agg(DISTINCT mti.anuncio_id ORDER BY mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      ARRAY(SELECT DISTINCT unnest(array_agg(mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL)) LIMIT 3) AS anuncio_ids
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
    -- JOIN para custo via produto_id (prioridade 1)
    LEFT JOIN produtos p ON p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0
    -- JOIN para custo via sku_marketplace (fallback)
    LEFT JOIN sku_costs sc ON sc.sku = mti.sku_marketplace AND sc.empresa_id = mt2.empresa_id
    WHERE mt2.empresa_id = ANY(v_empresa_ids)
      AND mt2.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt2.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt2.data_transacao < v_data_fim)
    GROUP BY COALESCE(mt2.pack_id, mt2.pedido_id), mt2.empresa_id
  ),
  resultado AS (
    SELECT
      vb.grp_pedido_id AS pedido_id,
      vb.empresa_id,
      vb.nome_fantasia AS empresa_nome_fantasia,
      vb.canal,
      vb.conta_nome,
      vb.data_pedido,
      vb.data_repasse,
      vb.status,
      vb.tipo_envio,
      vb.valor_produto,
      vb.comissao_agg AS comissao_total,
      vb.tarifa_fixa_agg AS tarifa_fixa_total,
      vb.frete_vendedor_agg AS frete_vendedor_total,
      vb.ads_total,
      -- Imposto calculado sobre valor bruto com aliquota por empresa
      ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2) AS impostos_total,
      vb.outros_descontos_agg AS outros_descontos_total,
      vb.rebate_agg AS rebate_total,
      vb.bonus_envio_agg AS bonus_envio_total,
      -- Valor líquido calculado
      vb.valor_produto
        - COALESCE(vb.comissao_agg, 0)
        - COALESCE(vb.tarifa_fixa_agg, 0)
        - COALESCE(vb.frete_vendedor_agg, 0)
        - COALESCE(vb.ads_total, 0)
        - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        - COALESCE(vb.outros_descontos_agg, 0)
        + COALESCE(vb.rebate_agg, 0)
        + COALESCE(vb.bonus_envio_agg, 0)
      AS valor_liquido_calculado,
      COALESCE(ia.qtd_itens, 0) AS qtd_itens,
      ia.cmv_total,
      -- Margem de contribuição: NULL se CMV não disponível
      CASE
        WHEN ia.cmv_total IS NOT NULL THEN
          vb.valor_produto
            - COALESCE(vb.comissao_agg, 0)
            - COALESCE(vb.tarifa_fixa_agg, 0)
            - COALESCE(vb.frete_vendedor_agg, 0)
            - COALESCE(vb.ads_total, 0)
            - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
            - COALESCE(vb.outros_descontos_agg, 0)
            + COALESCE(vb.rebate_agg, 0)
            + COALESCE(vb.bonus_envio_agg, 0)
            - ia.cmv_total
        ELSE NULL
      END AS margem_contribuicao,
      COALESCE(ia.tem_cmv, false) AS tem_cmv,
      ia.primeiro_anuncio_id,
      COALESCE(ia.anuncio_ids, ARRAY[]::text[]) AS anuncio_ids
    FROM vendas_base vb
    LEFT JOIN config_fiscal cf ON cf.empresa_id = vb.empresa_id
    LEFT JOIN itens_agg ia ON ia.grp_pedido_id = vb.grp_pedido_id AND ia.empresa_id = vb.empresa_id
  )
  SELECT *
  FROM resultado r
  WHERE
    (p_busca IS NULL OR r.pedido_id ILIKE '%' || p_busca || '%')
    AND (
      p_tem_custo IS NULL
      OR (p_tem_custo = 'com_custo' AND r.tem_cmv = true)
      OR (p_tem_custo = 'sem_custo' AND r.tem_cmv = false)
    )
  ORDER BY r.data_pedido DESC, r.pedido_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
