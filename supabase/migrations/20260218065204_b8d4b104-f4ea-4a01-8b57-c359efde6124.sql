
-- Drop das versões antigas com parâmetros p_limit/p_offset e recriar com p_page/p_page_size
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid,text,text,text,text,text,text,text,text,integer,integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid,text,text,text,text,text,text,text,text,int,int);

CREATE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id    uuid    DEFAULT NULL,
  p_data_inicio   text    DEFAULT NULL,
  p_data_fim      text    DEFAULT NULL,
  p_canal         text    DEFAULT NULL,
  p_conta         text    DEFAULT NULL,
  p_status        text    DEFAULT NULL,
  p_busca         text    DEFAULT NULL,
  p_tipo_envio    text    DEFAULT NULL,
  p_tem_custo     text    DEFAULT NULL,
  p_page          int     DEFAULT 0,
  p_page_size     int     DEFAULT 50
)
RETURNS TABLE (
  pedido_id                text,
  empresa_id               uuid,
  empresa_nome_fantasia    text,
  canal                    text,
  conta_nome               text,
  data_pedido              timestamptz,
  data_repasse             date,
  status                   text,
  tipo_envio               text,
  valor_produto            numeric,
  comissao_total           numeric,
  tarifa_fixa_total        numeric,
  frete_vendedor_total     numeric,
  ads_total                numeric,
  impostos_total           numeric,
  outros_descontos_total   numeric,
  valor_liquido_calculado  numeric,
  qtd_itens                bigint,
  cmv_total                numeric,
  margem_contribuicao      numeric,
  tem_cmv                  boolean,
  primeiro_anuncio_id      text,
  anuncio_ids              text[]
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_inicio  timestamptz;
  v_fim     timestamptz;
  v_offset  int;
BEGIN
  v_inicio := (COALESCE(p_data_inicio, to_char(now() - interval '7 days', 'YYYY-MM-DD')) || 'T00:00:00-03:00')::timestamptz;
  v_fim    := (COALESCE(p_data_fim,   to_char(now(), 'YYYY-MM-DD'))                       || 'T23:59:59-03:00')::timestamptz;
  v_offset := COALESCE(p_page, 0) * COALESCE(p_page_size, 50);

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS grp_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao)              AS data_pedido,
      MAX(mt.data_repasse)                AS data_repasse,
      MAX(mt.status)                      AS status_pedido,
      MAX(mt.tipo_envio)                  AS tipo_envio_v,
      SUM(mt.valor_produto)               AS valor_produto_agg,
      SUM(mt.comissao_marketplace)        AS comissao_agg,
      SUM(mt.tarifa_fixa)                 AS tarifa_fixa_agg,
      SUM(CASE WHEN mt.tipo_transacao IN ('venda','credit') THEN COALESCE(mt.frete_vendedor, 0) ELSE 0 END) AS frete_vendedor_api,
      SUM(CASE WHEN mt.tipo_transacao = 'bonus_envio' THEN ABS(mt.valor_produto) ELSE 0 END) AS bonus_envio_agg,
      SUM(mt.custo_ads)                   AS ads_agg,
      SUM(mt.outros_descontos)            AS outros_desc_agg,
      COUNT(DISTINCT mt.id)::bigint       AS qtd_events,
      SUM(mt.quantidade_itens)::bigint    AS qtd_itens_agg,
      MIN(mt.anuncio_id)                  AS primeiro_anuncio,
      ARRAY(
        SELECT DISTINCT unnest(array_agg(mt2.anuncio_id))
        FROM marketplace_transactions mt2
        WHERE mt2.anuncio_id IS NOT NULL
          AND COALESCE(mt2.pack_id, mt2.pedido_id, mt2.referencia_externa) =
              COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa)
          AND mt2.empresa_id = mt.empresa_id
        LIMIT 3
      ) AS anuncio_ids_arr
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao IN ('venda', 'credit', 'bonus_envio')
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao <= v_fim
      AND (p_canal       IS NULL OR mt.canal       = p_canal)
      AND (p_conta       IS NULL OR mt.conta_nome  = p_conta)
      AND (p_status      IS NULL OR mt.status      = p_status)
      AND (p_tipo_envio  IS NULL OR mt.tipo_envio  = p_tipo_envio)
      AND (p_busca       IS NULL OR
           mt.pedido_id  ILIKE '%' || p_busca || '%' OR
           mt.pack_id    ILIKE '%' || p_busca || '%' OR
           EXISTS (
             SELECT 1 FROM marketplace_transaction_items mti
             WHERE mti.marketplace_transaction_id = mt.id
               AND (mti.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti.descricao       ILIKE '%' || p_busca || '%')
           ))
    GROUP BY
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa),
      mt.empresa_id, mt.canal, mt.conta_nome
  ),
  logistica AS (
    SELECT empresa_id, flex_custo, flex_turbo_custo
    FROM empresa_logistica_config
  ),
  cmv_por_pedido AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS grp_id,
      mt.empresa_id,
      SUM(
        CASE WHEN mti.produto_id IS NOT NULL AND mti.custo_unitario IS NOT NULL
             THEN mti.quantidade * mti.custo_unitario
             ELSE NULL END
      ) AS cmv_total_calc,
      BOOL_OR(mti.produto_id IS NOT NULL AND mti.custo_unitario IS NOT NULL) AS tem_algum_cmv
    FROM marketplace_transactions mt
    JOIN marketplace_transaction_items mti ON mti.marketplace_transaction_id = mt.id
    WHERE mt.tipo_transacao IN ('venda', 'credit')
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao <= v_fim
    GROUP BY
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa),
      mt.empresa_id
  )
  SELECT
    pb.grp_id,
    pb.empresa_id,
    e.nome_fantasia,
    pb.canal,
    pb.conta_nome,
    pb.data_pedido,
    pb.data_repasse,
    pb.status_pedido,
    pb.tipo_envio_v,
    pb.valor_produto_agg,
    pb.comissao_agg,
    pb.tarifa_fixa_agg,
    CASE
      WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api > 0 THEN
        GREATEST(0, COALESCE(l.flex_custo, 0) - pb.bonus_envio_agg)
      WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api = 0 AND pb.bonus_envio_agg = 0 THEN
        0
      WHEN pb.bonus_envio_agg > 0 THEN
        GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
      ELSE pb.frete_vendedor_api
    END AS frete_vendedor_total,
    pb.ads_agg,
    0::numeric AS impostos_total,
    pb.outros_desc_agg,
    (pb.valor_produto_agg
      - COALESCE(pb.comissao_agg, 0)
      - COALESCE(pb.tarifa_fixa_agg, 0)
      - CASE
          WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api > 0 THEN
            GREATEST(0, COALESCE(l.flex_custo, 0) - pb.bonus_envio_agg)
          WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api = 0 AND pb.bonus_envio_agg = 0 THEN 0
          WHEN pb.bonus_envio_agg > 0 THEN GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
          ELSE pb.frete_vendedor_api
        END
      - COALESCE(pb.ads_agg, 0)
      - COALESCE(pb.outros_desc_agg, 0)
    ) AS valor_liquido_calculado,
    pb.qtd_itens_agg,
    cp.cmv_total_calc,
    CASE WHEN cp.cmv_total_calc IS NOT NULL
         THEN (pb.valor_produto_agg
                - COALESCE(pb.comissao_agg, 0)
                - COALESCE(pb.tarifa_fixa_agg, 0)
                - CASE
                    WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api > 0 THEN
                      GREATEST(0, COALESCE(l.flex_custo, 0) - pb.bonus_envio_agg)
                    WHEN pb.tipo_envio_v IN ('flex', 'flex_turbo') AND pb.frete_vendedor_api = 0 AND pb.bonus_envio_agg = 0 THEN 0
                    WHEN pb.bonus_envio_agg > 0 THEN GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
                    ELSE pb.frete_vendedor_api
                  END
                - COALESCE(pb.ads_agg, 0)
                - COALESCE(pb.outros_desc_agg, 0)
                - cp.cmv_total_calc)
         ELSE NULL
    END AS margem_contribuicao,
    COALESCE(cp.tem_algum_cmv, false),
    pb.primeiro_anuncio,
    pb.anuncio_ids_arr
  FROM pedidos_base pb
  LEFT JOIN empresas e ON e.id = pb.empresa_id
  LEFT JOIN logistica l ON l.empresa_id = pb.empresa_id
  LEFT JOIN cmv_por_pedido cp ON cp.grp_id = pb.grp_id AND cp.empresa_id = pb.empresa_id
  WHERE (
    p_tem_custo IS NULL
    OR (p_tem_custo = 'com_custo' AND COALESCE(cp.tem_algum_cmv, false) = true)
    OR (p_tem_custo = 'sem_custo' AND COALESCE(cp.tem_algum_cmv, false) = false)
  )
  ORDER BY pb.data_pedido DESC
  LIMIT  COALESCE(p_page_size, 50)
  OFFSET v_offset;
END;
$$;
