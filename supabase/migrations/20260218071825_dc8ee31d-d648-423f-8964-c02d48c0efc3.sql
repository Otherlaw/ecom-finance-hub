
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id   uuid    DEFAULT NULL,
  p_data_inicio  text    DEFAULT NULL,
  p_data_fim     text    DEFAULT NULL,
  p_canal        text    DEFAULT NULL,
  p_conta        text    DEFAULT NULL,
  p_status       text    DEFAULT NULL,
  p_busca        text    DEFAULT NULL,
  p_tipo_envio   text    DEFAULT NULL,
  p_tem_custo    text    DEFAULT NULL,
  p_page         integer DEFAULT 0,
  p_page_size    integer DEFAULT 50
)
RETURNS TABLE(
  pedido_id              text,
  empresa_id             uuid,
  empresa_nome_fantasia  text,
  canal                  text,
  conta_nome             text,
  data_pedido            timestamptz,
  data_repasse           date,
  status                 text,
  tipo_envio             text,
  valor_produto          numeric,
  comissao_total         numeric,
  tarifa_fixa_total      numeric,
  frete_vendedor_total   numeric,
  ads_total              numeric,
  impostos_total         numeric,
  outros_descontos_total numeric,
  valor_liquido_calculado numeric,
  qtd_itens              bigint,
  cmv_total              numeric,
  margem_contribuicao    numeric,
  tem_cmv                boolean,
  primeiro_anuncio_id    text,
  anuncio_ids            text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio    timestamptz;
  v_fim       timestamptz;
  v_offset    int;
  v_emp_ids   uuid[];
BEGIN
  -- Segurança: verificar empresas do usuário
  v_emp_ids := public.get_user_empresa_ids();
  IF array_length(v_emp_ids, 1) IS NULL THEN RETURN; END IF;
  IF p_empresa_id IS NOT NULL AND NOT (p_empresa_id = ANY(v_emp_ids)) THEN RETURN; END IF;

  v_inicio := (COALESCE(p_data_inicio, to_char(now() - interval '7 days', 'YYYY-MM-DD')) || 'T00:00:00-03:00')::timestamptz;
  v_fim    := (COALESCE(p_data_fim, to_char(now(), 'YYYY-MM-DD')) || 'T23:59:59-03:00')::timestamptz;
  v_offset := COALESCE(p_page, 0) * COALESCE(p_page_size, 50);

  RETURN QUERY
  WITH pedidos_paginados AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS grp_id,
      mt.empresa_id AS emp_id,
      MIN(mt.data_transacao) AS data_min
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_empresa_id IS NOT NULL OR mt.empresa_id = ANY(v_emp_ids))
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao <= v_fim
      AND (p_canal      IS NULL OR mt.canal      = p_canal)
      AND (p_conta      IS NULL OR mt.conta_nome = p_conta)
      AND (p_status     IS NULL OR mt.status     = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio = p_tipo_envio)
      AND (p_busca IS NULL OR
           mt.pedido_id ILIKE '%' || p_busca || '%' OR
           mt.pack_id   ILIKE '%' || p_busca || '%')
    GROUP BY
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa),
      mt.empresa_id
    ORDER BY MIN(mt.data_transacao) DESC, COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa)
    LIMIT p_page_size
    OFFSET v_offset
  ),
  pedidos_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS grp_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao)              AS data_pedido,
      MAX(mt.data_repasse)                AS data_repasse,
      MAX(mt.status)                      AS status_pedido,
      MAX(mt.tipo_envio)                  AS tipo_envio_v,
      SUM(mt.valor_bruto)                 AS valor_bruto_agg,
      SUM(COALESCE(mt.tarifas, 0))        AS comissao_agg,
      SUM(COALESCE(mt.taxas, 0))          AS tarifa_fixa_agg,
      SUM(COALESCE(mt.frete_vendedor, 0)) AS frete_vendedor_api,
      SUM(COALESCE(mt.bonus_envio, 0))    AS bonus_envio_agg,
      SUM(COALESCE(mt.custo_ads, 0))      AS ads_agg,
      SUM(COALESCE(mt.outros_descontos,0)) AS outros_desc_agg,
      SUM(COALESCE(mt.valor_liquido, 0))  AS valor_liq_agg
    FROM marketplace_transactions mt
    INNER JOIN pedidos_paginados pp
      ON COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) = pp.grp_id
     AND mt.empresa_id = pp.emp_id
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
    GROUP BY
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa),
      mt.empresa_id, mt.canal, mt.conta_nome
  ),
  -- CORREÇÃO: qualificar empresa_id com alias da tabela para evitar ambiguidade
  logistica AS (
    SELECT elc.empresa_id, elc.flex_custo, elc.flex_turbo_custo
    FROM empresa_logistica_config elc
  ),
  fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
  ),
  cmv_por_pedido AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS grp_id,
      mt.empresa_id,
      SUM(mti.quantidade)::bigint AS qtd_itens,
      SUM(
        CASE
          WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0
            THEN mti.quantidade * p.custo_medio
          WHEN sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0
            THEN mti.quantidade * sc.custo_unitario
          ELSE NULL
        END
      ) AS cmv_calc,
      BOOL_OR(
        (p.custo_medio IS NOT NULL AND p.custo_medio > 0) OR
        (sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
      ) AS has_cmv,
      (ARRAY_AGG(mti.anuncio_id ORDER BY mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio,
      ARRAY(
        SELECT DISTINCT a_id FROM unnest(
          ARRAY_AGG(mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL)
        ) a_id
        LIMIT 3
      ) AS anuncio_ids_arr
    FROM marketplace_transactions mt
    INNER JOIN pedidos_paginados pp
      ON COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) = pp.grp_id
     AND mt.empresa_id = pp.emp_id
    INNER JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    LEFT JOIN sku_costs sc
      ON sc.sku = mti.sku_marketplace
     AND sc.empresa_id = mt.empresa_id
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
    GROUP BY
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa),
      mt.empresa_id
  ),
  resultado AS (
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
      pb.valor_bruto_agg,
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
      END AS frete_efetivo,
      pb.ads_agg,
      pb.outros_desc_agg,
      pb.valor_liq_agg,
      COALESCE(cp.qtd_itens, 0)::bigint AS qtd_itens,
      cp.cmv_calc,
      COALESCE(cp.has_cmv, false) AS has_cmv,
      cp.primeiro_anuncio,
      cp.anuncio_ids_arr,
      COALESCE(f.aliquota_imposto_vendas, 6) AS aliquota
    FROM pedidos_base pb
    LEFT JOIN empresas e ON e.id = pb.empresa_id
    LEFT JOIN logistica l ON l.empresa_id = pb.empresa_id
    LEFT JOIN fiscal f ON f.empresa_id = pb.empresa_id
    LEFT JOIN cmv_por_pedido cp
      ON cp.grp_id = pb.grp_id
     AND cp.empresa_id = pb.empresa_id
  )
  SELECT
    r.grp_id                                          AS pedido_id,
    r.empresa_id,
    r.nome_fantasia                                   AS empresa_nome_fantasia,
    r.canal,
    r.conta_nome,
    r.data_pedido,
    r.data_repasse,
    r.status_pedido                                   AS status,
    r.tipo_envio_v                                    AS tipo_envio,
    r.valor_bruto_agg                                 AS valor_produto,
    r.comissao_agg                                    AS comissao_total,
    r.tarifa_fixa_agg                                 AS tarifa_fixa_total,
    r.frete_efetivo                                   AS frete_vendedor_total,
    r.ads_agg                                         AS ads_total,
    (r.valor_bruto_agg * r.aliquota / 100)            AS impostos_total,
    r.outros_desc_agg                                 AS outros_descontos_total,
    r.valor_liq_agg                                   AS valor_liquido_calculado,
    r.qtd_itens,
    r.cmv_calc                                        AS cmv_total,
    CASE WHEN r.has_cmv THEN
      r.valor_liq_agg - r.comissao_agg - r.tarifa_fixa_agg - r.frete_efetivo
      - r.ads_agg - (r.valor_bruto_agg * r.aliquota / 100) - COALESCE(r.cmv_calc, 0)
    ELSE NULL END                                     AS margem_contribuicao,
    r.has_cmv                                         AS tem_cmv,
    r.primeiro_anuncio                                AS primeiro_anuncio_id,
    COALESCE(r.anuncio_ids_arr, ARRAY[]::text[])      AS anuncio_ids
  FROM resultado r
  ORDER BY r.data_pedido DESC, r.grp_id;
END;
$$;
