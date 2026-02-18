
-- Drop necessário pois a assinatura de retorno mudou
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text, text, text, text, text, text, text, integer, integer);

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
  group_key text,
  empresa_id uuid,
  canal text,
  conta_nome text,
  pedido_id text,
  pack_id text,
  data_transacao timestamptz,
  status text,
  tipo_envio text,
  qtd_itens numeric,
  valor_bruto numeric,
  comissao numeric,
  tarifa_fixa numeric,
  frete_vendedor_total numeric,
  custo_ads numeric,
  outros_descontos numeric,
  valor_liquido numeric,
  imposto_estimado numeric,
  cmv_total numeric,
  margem_contribuicao numeric,
  margem_percentual numeric,
  has_cmv boolean,
  thumbnail_urls text[],
  anuncio_ids text[],
  produto_ids text[],
  sku_list text[],
  descricao_itens text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN
    RETURN;
  END IF;

  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  END IF;
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';
  END IF;

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id)                            AS gk,
      mt.empresa_id                                                  AS emp_id,
      (ARRAY_AGG(mt.canal ORDER BY mt.data_transacao DESC))[1]      AS canal_v,
      (ARRAY_AGG(mt.conta_nome ORDER BY mt.data_transacao DESC))[1] AS conta_v,
      (ARRAY_AGG(mt.pedido_id ORDER BY mt.data_transacao DESC))[1]  AS pedido_v,
      (ARRAY_AGG(mt.pack_id ORDER BY mt.data_transacao DESC))[1]    AS pack_v,
      MIN(mt.data_transacao)                                         AS data_v,
      (ARRAY_AGG(mt.status ORDER BY mt.data_transacao DESC))[1]     AS status_v,
      (ARRAY_AGG(COALESCE(mt.tipo_envio, 'coleta') ORDER BY mt.data_transacao DESC))[1] AS tipo_envio_v,
      SUM(COALESCE(mt.valor_bruto, 0))                              AS val_bruto,
      SUM(COALESCE(mt.taxas, 0))                                    AS comissao_agg,
      SUM(COALESCE(mt.tarifas, 0))                                  AS tarifa_agg,
      SUM(COALESCE(mt.frete_vendedor, 0))                           AS frete_vendedor_api,
      SUM(COALESCE(mt.custo_ads, 0))                                AS ads_agg,
      SUM(COALESCE(mt.outros_descontos, 0))                         AS outros_agg,
      SUM(COALESCE(mt.valor_liquido, 0))                            AS liq_agg,
      SUM(COALESCE(mt.bonus_envio,
        COALESCE((mt.raw_shipping_costs->'raw_senders'->0->'save')::numeric, 0),
        0
      ))                                                             AS bonus_envio_agg
    FROM marketplace_transactions mt
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
      AND (p_canal IS NULL OR mt.canal ILIKE p_canal)
      AND (p_conta IS NULL OR mt.conta_nome ILIKE p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
      AND (p_tipo_envio IS NULL OR COALESCE(mt.tipo_envio, 'coleta') = p_tipo_envio)
      AND (p_busca IS NULL OR COALESCE(mt.pack_id, mt.pedido_id) ILIKE '%' || p_busca || '%')
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id
  ),

  logistica AS (
    SELECT lpc.empresa_id, lpc.canal, lpc.tipo_envio, lpc.custo
    FROM logistica_plataforma_config lpc
    WHERE lpc.empresa_id = ANY(v_empresa_ids)
  ),

  itens_agg AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id)  AS gk,
      mt.empresa_id                        AS emp_id,
      SUM(COALESCE(mti.quantidade, 1))     AS qtd,
      SUM(
        COALESCE(mti.quantidade, 1) * COALESCE(
          NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id LIMIT 1), 0),
          NULLIF((SELECT p.custo_medio FROM produto_marketplace_map pmm
                  JOIN produtos p ON p.id = pmm.produto_id
                  WHERE pmm.sku_marketplace = mti.sku_marketplace
                    AND pmm.empresa_id = mt.empresa_id
                    AND pmm.ativo = true
                    AND COALESCE(p.custo_medio, 0) > 0
                  LIMIT 1), 0),
          NULLIF((SELECT p.custo_medio FROM produtos p
                  WHERE p.sku = mti.sku_marketplace
                    AND p.empresa_id = mt.empresa_id
                    AND COALESCE(p.custo_medio, 0) > 0
                  LIMIT 1), 0),
          NULLIF((SELECT sc.custo_unitario FROM sku_costs sc
                  WHERE sc.sku = mti.sku_marketplace
                    AND sc.empresa_id = mt.empresa_id
                  LIMIT 1), 0),
          0
        )
      )                                    AS cmv,
      BOOL_OR(
        COALESCE(
          NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id LIMIT 1), 0),
          NULLIF((SELECT p.custo_medio FROM produto_marketplace_map pmm
                  JOIN produtos p ON p.id = pmm.produto_id
                  WHERE pmm.sku_marketplace = mti.sku_marketplace
                    AND pmm.empresa_id = mt.empresa_id
                    AND pmm.ativo = true
                    AND COALESCE(p.custo_medio, 0) > 0
                  LIMIT 1), 0),
          NULLIF((SELECT p.custo_medio FROM produtos p
                  WHERE p.sku = mti.sku_marketplace
                    AND p.empresa_id = mt.empresa_id
                    AND COALESCE(p.custo_medio, 0) > 0
                  LIMIT 1), 0),
          NULLIF((SELECT sc.custo_unitario FROM sku_costs sc
                  WHERE sc.sku = mti.sku_marketplace
                    AND sc.empresa_id = mt.empresa_id
                  LIMIT 1), 0)
        ) IS NOT NULL
      )                                    AS has_cmv,
      ARRAY_AGG(DISTINCT mti.thumbnail_url) FILTER (WHERE mti.thumbnail_url IS NOT NULL) AS thumbnails,
      ARRAY_AGG(DISTINCT mti.anuncio_id)    FILTER (WHERE mti.anuncio_id IS NOT NULL)    AS anuncios,
      ARRAY_AGG(DISTINCT mti.produto_id::text) FILTER (WHERE mti.produto_id IS NOT NULL) AS prod_ids,
      ARRAY_AGG(DISTINCT mti.sku_marketplace)  FILTER (WHERE mti.sku_marketplace IS NOT NULL) AS skus,
      ARRAY_AGG(DISTINCT mti.descricao_item)   FILTER (WHERE mti.descricao_item IS NOT NULL)  AS descricoes
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim IS NULL OR mt.data_transacao < v_data_fim)
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id
  ),

  config_fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
    WHERE ecf.empresa_id = ANY(v_empresa_ids)
  ),

  resultado AS (
    SELECT
      pb.gk,
      pb.emp_id,
      pb.canal_v,
      pb.conta_v,
      pb.pedido_v,
      pb.pack_v,
      pb.data_v,
      pb.status_v,
      pb.tipo_envio_v,
      COALESCE(ia.qtd, 0)              AS qtd_itens,
      pb.val_bruto,
      pb.comissao_agg,
      pb.tarifa_agg,
      -- ============================================================
      -- LÓGICA DE FRETE EFETIVO:
      --
      -- Flex/Flex Turbo + frete_api > 0:
      --   custo_config - bonus (vendedor pagou, ML devolveu parte)
      --
      -- Flex/Flex Turbo + frete_api = 0 + bonus = 0:
      --   0 → ML subsidiou 100% via loyal, vendedor não pagou nada
      --
      -- Qualquer tipo + bonus > 0:
      --   frete_api - bonus (ex: Coleta Flex parcialmente subsidiado)
      --
      -- Demais (Full, Coleta sem bonus):
      --   frete_api direto
      -- ============================================================
      CASE
        WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api > 0 THEN
          GREATEST(0, COALESCE(l.custo, 0) - pb.bonus_envio_agg)
        WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo')
          AND pb.frete_vendedor_api = 0 AND pb.bonus_envio_agg = 0 THEN
          0
        WHEN pb.bonus_envio_agg > 0 THEN
          GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
        ELSE
          pb.frete_vendedor_api
      END                              AS frete_efetivo,
      pb.ads_agg,
      pb.outros_agg,
      pb.liq_agg,
      COALESCE(cf.aliquota_imposto_vendas, 6) AS aliquota,
      COALESCE(ia.cmv, 0)             AS cmv_v,
      COALESCE(ia.has_cmv, false)     AS has_cmv_v,
      ia.thumbnails,
      ia.anuncios,
      ia.prod_ids,
      ia.skus,
      ia.descricoes
    FROM pedidos_base pb
    LEFT JOIN itens_agg ia    ON ia.gk = pb.gk AND ia.emp_id = pb.emp_id
    LEFT JOIN config_fiscal cf ON cf.empresa_id = pb.emp_id
    LEFT JOIN logistica l      ON l.empresa_id = pb.emp_id
      AND l.canal = pb.canal_v
      AND l.tipo_envio = pb.tipo_envio_v
  )

  SELECT
    r.gk                                               AS group_key,
    r.emp_id                                           AS empresa_id,
    r.canal_v                                          AS canal,
    r.conta_v                                          AS conta_nome,
    r.pedido_v                                         AS pedido_id,
    r.pack_v                                           AS pack_id,
    r.data_v                                           AS data_transacao,
    r.status_v                                         AS status,
    r.tipo_envio_v                                     AS tipo_envio,
    r.qtd_itens,
    r.val_bruto                                        AS valor_bruto,
    r.comissao_agg                                     AS comissao,
    r.tarifa_agg                                       AS tarifa_fixa,
    r.frete_efetivo                                    AS frete_vendedor_total,
    r.ads_agg                                          AS custo_ads,
    r.outros_agg                                       AS outros_descontos,
    r.liq_agg                                          AS valor_liquido,
    (r.val_bruto * r.aliquota / 100)                   AS imposto_estimado,
    r.cmv_v                                            AS cmv_total,
    CASE
      WHEN r.has_cmv_v THEN
        r.liq_agg - r.frete_efetivo - r.cmv_v - (r.val_bruto * r.aliquota / 100)
      ELSE NULL
    END                                                AS margem_contribuicao,
    CASE
      WHEN r.has_cmv_v AND r.val_bruto > 0 THEN
        ROUND(
          (r.liq_agg - r.frete_efetivo - r.cmv_v - (r.val_bruto * r.aliquota / 100))
          / r.val_bruto * 100,
          2
        )
      ELSE NULL
    END                                                AS margem_percentual,
    r.has_cmv_v                                        AS has_cmv,
    COALESCE(r.thumbnails, ARRAY[]::text[])            AS thumbnail_urls,
    COALESCE(r.anuncios, ARRAY[]::text[])              AS anuncio_ids,
    COALESCE(r.prod_ids, ARRAY[]::text[])              AS produto_ids,
    COALESCE(r.skus, ARRAY[]::text[])                  AS sku_list,
    COALESCE(r.descricoes, ARRAY[]::text[])            AS descricao_itens
  FROM resultado r
  WHERE (p_tem_custo IS NULL
    OR (p_tem_custo = 'sim' AND r.has_cmv_v = true)
    OR (p_tem_custo = 'nao' AND r.has_cmv_v = false))
  ORDER BY r.data_v DESC, r.gk DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
