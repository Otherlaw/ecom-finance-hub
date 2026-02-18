
-- Drop com assinaturas exatas
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text, text, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo_v2(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamptz,
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
      CASE 
        WHEN bool_and(mti.produto_id IS NOT NULL AND sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
        THEN SUM(mti.quantidade * COALESCE(sc.custo_unitario, 0))
        ELSE NULL
      END AS cmv_total,
      bool_and(mti.produto_id IS NOT NULL AND sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0) AS tem_cmv,
      (array_agg(DISTINCT mti.anuncio_id ORDER BY mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      ARRAY(SELECT DISTINCT unnest(array_agg(mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL)) LIMIT 3) AS anuncio_ids
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
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
      ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2) AS impostos_total,
      vb.outros_descontos_agg AS outros_descontos_total,
      vb.rebate_agg AS rebate_total,
      vb.bonus_envio_agg AS bonus_envio_total,
      ROUND(
        vb.valor_produto 
        - COALESCE(vb.comissao_agg, 0)
        - COALESCE(vb.tarifa_fixa_agg, 0)
        - COALESCE(vb.frete_vendedor_agg, 0)
        - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        + COALESCE(vb.rebate_agg, 0)
        + COALESCE(vb.bonus_envio_agg, 0)
        - COALESCE(vb.outros_descontos_agg, 0), 2
      ) AS valor_liquido_calculado,
      COALESCE(ia.qtd_itens, 0) AS qtd_itens,
      ia.cmv_total,
      CASE 
        WHEN ia.cmv_total IS NOT NULL THEN
          ROUND(
            vb.valor_produto 
            - COALESCE(vb.comissao_agg, 0)
            - COALESCE(vb.tarifa_fixa_agg, 0)
            - COALESCE(vb.frete_vendedor_agg, 0)
            - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
            + COALESCE(vb.rebate_agg, 0)
            + COALESCE(vb.bonus_envio_agg, 0)
            - COALESCE(vb.outros_descontos_agg, 0)
            - ia.cmv_total, 2
          )
        ELSE NULL
      END AS margem_contribuicao,
      COALESCE(ia.tem_cmv, false) AS tem_cmv,
      ia.primeiro_anuncio_id,
      COALESCE(ia.anuncio_ids, ARRAY[]::text[]) AS anuncio_ids
    FROM vendas_base vb
    LEFT JOIN config_fiscal cf ON cf.empresa_id = vb.empresa_id
    LEFT JOIN itens_agg ia ON ia.grp_pedido_id = vb.grp_pedido_id AND ia.empresa_id = vb.empresa_id
  )
  SELECT
    r.pedido_id, r.empresa_id, r.empresa_nome_fantasia, r.canal, r.conta_nome,
    r.data_pedido, r.data_repasse, r.status, r.tipo_envio, r.valor_produto,
    r.comissao_total, r.tarifa_fixa_total, r.frete_vendedor_total, r.ads_total,
    r.impostos_total, r.outros_descontos_total, r.rebate_total, r.bonus_envio_total,
    r.valor_liquido_calculado, r.qtd_itens, r.cmv_total, r.margem_contribuicao,
    r.tem_cmv, r.primeiro_anuncio_id, r.anuncio_ids
  FROM resultado r
  WHERE (p_busca IS NULL OR r.pedido_id ILIKE '%' || p_busca || '%')
  AND (p_tem_custo IS NULL
    OR (p_tem_custo = 'com_custo' AND r.tem_cmv = true)
    OR (p_tem_custo = 'sem_custo' AND r.tem_cmv = false))
  ORDER BY r.data_pedido DESC, r.pedido_id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_ids uuid[];
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_count bigint;
BEGIN
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id) INTO v_empresa_ids
    FROM user_empresas ue WHERE ue.user_id = auth.uid();
  END IF;

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN RETURN 0; END IF;

  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  END IF;
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';
  END IF;

  SELECT COUNT(DISTINCT COALESCE(mt.pack_id, mt.pedido_id)) INTO v_count
  FROM marketplace_transactions mt
  WHERE mt.empresa_id = ANY(v_empresa_ids)
    AND mt.tipo_transacao = 'venda'
    AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
    AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
    AND (p_canal IS NULL OR mt.canal ILIKE p_canal)
    AND (p_conta IS NULL OR mt.conta_nome ILIKE p_conta)
    AND (p_status IS NULL OR mt.status = p_status)
    AND (p_tipo_envio IS NULL OR mt.tipo_envio = p_tipo_envio)
    AND (p_busca IS NULL OR COALESCE(mt.pack_id, mt.pedido_id) ILIKE '%' || p_busca || '%');

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo_v2(
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
  rebate_total numeric,
  bonus_envio_total numeric,
  valor_liquido_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv bigint,
  pedidos_sem_cmv bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
  WITH vendas_agg AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id) AS grp_pedido_id,
      mt.empresa_id,
      SUM(COALESCE(mt.valor_bruto, 0)) AS valor_produto,
      SUM(COALESCE(mt.taxas, 0)) AS comissao,
      SUM(COALESCE(mt.tarifas, 0)) AS tarifa_fixa,
      SUM(COALESCE(mt.frete_vendedor, 0)) AS frete_vendedor,
      SUM(COALESCE(mt.custo_ads, 0)) AS ads,
      SUM(COALESCE(mt.rebate, 0)) AS rebate,
      SUM(COALESCE(mt.bonus_envio, 0)) AS bonus_envio,
      SUM(COALESCE(mt.outros_descontos, 0)) AS outros_descontos
    FROM marketplace_transactions mt
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, COALESCE(ecf.aliquota_imposto_vendas, 6.0) AS aliquota_imposto
    FROM empresas_config_fiscal ecf WHERE ecf.empresa_id = ANY(v_empresa_ids)
  ),
  itens_agg AS (
    SELECT
      COALESCE(mt2.pack_id, mt2.pedido_id) AS grp_pedido_id,
      mt2.empresa_id,
      SUM(mti.quantidade) AS qtd_itens,
      CASE 
        WHEN bool_and(mti.produto_id IS NOT NULL AND sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
        THEN SUM(mti.quantidade * COALESCE(sc.custo_unitario, 0))
        ELSE NULL
      END AS cmv_total,
      bool_and(mti.produto_id IS NOT NULL AND sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0) AS tem_cmv
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
    LEFT JOIN sku_costs sc ON sc.sku = mti.sku_marketplace AND sc.empresa_id = mt2.empresa_id
    WHERE mt2.empresa_id = ANY(v_empresa_ids)
      AND mt2.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt2.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt2.data_transacao < v_data_fim)
    GROUP BY COALESCE(mt2.pack_id, mt2.pedido_id), mt2.empresa_id
  ),
  resultado AS (
    SELECT
      va.grp_pedido_id,
      va.empresa_id,
      va.valor_produto,
      va.comissao,
      va.tarifa_fixa,
      va.frete_vendedor,
      va.ads,
      va.rebate,
      va.bonus_envio,
      va.outros_descontos,
      ROUND(va.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2) AS impostos,
      ia.cmv_total,
      COALESCE(ia.tem_cmv, false) AS tem_cmv,
      COALESCE(ia.qtd_itens, 0) AS qtd_itens,
      ROUND(va.valor_produto - COALESCE(va.comissao, 0) - COALESCE(va.tarifa_fixa, 0)
        - COALESCE(va.frete_vendedor, 0)
        - ROUND(va.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        + COALESCE(va.rebate, 0) + COALESCE(va.bonus_envio, 0)
        - COALESCE(va.outros_descontos, 0), 2) AS valor_liquido,
      CASE WHEN ia.cmv_total IS NOT NULL THEN
        ROUND(va.valor_produto - COALESCE(va.comissao, 0) - COALESCE(va.tarifa_fixa, 0)
          - COALESCE(va.frete_vendedor, 0)
          - ROUND(va.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
          + COALESCE(va.rebate, 0) + COALESCE(va.bonus_envio, 0)
          - COALESCE(va.outros_descontos, 0)
          - ia.cmv_total, 2)
      ELSE NULL END AS margem_contribuicao
    FROM vendas_agg va
    LEFT JOIN config_fiscal cf ON cf.empresa_id = va.empresa_id
    LEFT JOIN itens_agg ia ON ia.grp_pedido_id = va.grp_pedido_id AND ia.empresa_id = va.empresa_id
  )
  SELECT
    COUNT(DISTINCT r.grp_pedido_id)::bigint,
    COALESCE(SUM(r.qtd_itens), 0),
    COALESCE(SUM(r.valor_produto), 0),
    COALESCE(SUM(r.comissao), 0),
    COALESCE(SUM(r.tarifa_fixa), 0),
    COALESCE(SUM(r.frete_vendedor), 0),
    COALESCE(SUM(r.ads), 0),
    COALESCE(SUM(r.impostos), 0),
    COALESCE(SUM(r.rebate), 0),
    COALESCE(SUM(r.bonus_envio), 0),
    COALESCE(SUM(r.valor_liquido), 0),
    COALESCE(SUM(r.cmv_total) FILTER (WHERE r.cmv_total IS NOT NULL), 0),
    COALESCE(SUM(r.margem_contribuicao) FILTER (WHERE r.margem_contribuicao IS NOT NULL), 0),
    COUNT(*) FILTER (WHERE r.tem_cmv = true)::bigint,
    COUNT(*) FILTER (WHERE r.tem_cmv = false)::bigint
  FROM resultado r;
END;
$$;
