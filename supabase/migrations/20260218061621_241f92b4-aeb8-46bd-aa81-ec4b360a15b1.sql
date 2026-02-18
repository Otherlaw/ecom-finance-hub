
-- Versão final otimizada: pagina ANTES de buscar itens/CMV
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
  qtd_itens                numeric,
  cmv_total                numeric,
  margem_contribuicao      numeric,
  tem_cmv                  boolean,
  primeiro_anuncio_id      text,
  anuncio_ids              text[]
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_empresa_ids uuid[];
  v_data_inicio timestamptz;
  v_data_fim    timestamptz;
BEGIN
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id) INTO v_empresa_ids
    FROM user_empresas ue WHERE ue.user_id = auth.uid();
  END IF;

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN RETURN; END IF;

  v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  v_data_fim    := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';

  RETURN QUERY
  WITH
  -- PASSO 1: Agregar por pedido/pack — apenas dados da tabela principal (leve)
  pedidos_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id)           AS ped_key,
      mt.empresa_id,
      mt.tipo_envio,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao)                        AS data_pedido,
      MAX(mt.data_repasse)                          AS data_repasse,
      (array_agg(mt.status ORDER BY mt.data_transacao DESC))[1] AS status,
      SUM(COALESCE(mt.valor_bruto, 0))              AS valor_produto_agg,
      SUM(COALESCE(mt.taxas, 0))                    AS comissao_agg,
      SUM(COALESCE(mt.tarifas, 0))                  AS tarifa_fixa_agg,
      SUM(COALESCE(mt.frete_vendedor, 0))           AS frete_vendedor_api,
      SUM(COALESCE(mt.bonus_envio, 0))              AS bonus_envio_agg,
      SUM(COALESCE(mt.custo_ads, 0))                AS ads_agg,
      SUM(COALESCE(mt.outros_descontos, 0))         AS outros_descontos_agg
    FROM marketplace_transactions mt
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <  v_data_fim
      AND (p_canal      IS NULL OR mt.canal       ILIKE p_canal)
      AND (p_conta      IS NULL OR mt.conta_nome  ILIKE p_conta)
      AND (p_status     IS NULL OR mt.status      = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio  = p_tipo_envio)
      AND (p_busca      IS NULL OR COALESCE(mt.pack_id, mt.pedido_id) ILIKE '%' || p_busca || '%')
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id, mt.tipo_envio, mt.canal, mt.conta_nome
  ),

  -- PASSO 2: Frete efetivo com config de logística
  pedidos_frete AS (
    SELECT
      pb.*,
      CASE
        WHEN pb.tipo_envio IN ('flex', 'flex_turbo') THEN
          GREATEST(0,
            COALESCE((
              SELECT lpc.custo FROM logistica_plataforma_config lpc
              WHERE lpc.empresa_id = pb.empresa_id AND lpc.tipo_envio = pb.tipo_envio
              LIMIT 1
            ), 0) - pb.bonus_envio_agg
          )
        ELSE pb.frete_vendedor_api
      END AS frete_efetivo,
      COALESCE((
        SELECT ecf.aliquota_imposto_vendas / 100.0
        FROM empresas_config_fiscal ecf WHERE ecf.empresa_id = pb.empresa_id LIMIT 1
      ), 0.06) AS aliquota_imp
    FROM pedidos_base pb
  ),

  -- PASSO 3: Paginação SEM itens (rápida)
  pedidos_paginados AS (
    SELECT *
    FROM pedidos_frete
    ORDER BY data_pedido DESC, ped_key
    LIMIT  p_page_size
    OFFSET (p_page * p_page_size)
  ),

  -- PASSO 4: Buscar IDs das transações APENAS dos pedidos paginados
  tx_ids_paginados AS (
    SELECT mt.id AS tx_id, COALESCE(mt.pack_id, mt.pedido_id) AS ped_key, mt.empresa_id
    FROM marketplace_transactions mt
    JOIN pedidos_paginados pp
      ON COALESCE(mt.pack_id, mt.pedido_id) = pp.ped_key
     AND mt.empresa_id = pp.empresa_id
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <  v_data_fim
  ),

  -- PASSO 5: Itens e CMV apenas dos pedidos paginados
  itens_paginados AS (
    SELECT
      tip.ped_key,
      tip.empresa_id,
      SUM(mti.quantidade)                            AS qtd_itens,
      SUM(
        CASE
          WHEN sc.custo_unitario > 0 THEN mti.quantidade * sc.custo_unitario
          WHEN p.custo_medio > 0     THEN mti.quantidade * p.custo_medio
          ELSE NULL
        END
      )                                              AS cmv_calculado,
      (array_agg(mti.anuncio_id ORDER BY mti.created_at)
        FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      (SELECT array_agg(DISTINCT aid) FROM unnest(
         array_agg(mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL)
       ) aid LIMIT 3)                               AS anuncio_ids_arr
    FROM tx_ids_paginados tip
    JOIN marketplace_transaction_items mti ON mti.transaction_id = tip.tx_id
    LEFT JOIN sku_costs sc
      ON sc.sku = mti.sku_marketplace AND sc.empresa_id = tip.empresa_id
    LEFT JOIN produtos p
      ON p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0
    GROUP BY tip.ped_key, tip.empresa_id
  )

  -- PASSO 6: Resultado final
  SELECT
    pp.ped_key                                                       AS pedido_id,
    pp.empresa_id,
    e.nome_fantasia                                                   AS empresa_nome_fantasia,
    pp.canal,
    pp.conta_nome,
    pp.data_pedido,
    pp.data_repasse,
    pp.status,
    pp.tipo_envio,
    pp.valor_produto_agg                                             AS valor_produto,
    pp.comissao_agg                                                  AS comissao_total,
    pp.tarifa_fixa_agg                                               AS tarifa_fixa_total,
    pp.frete_efetivo                                                 AS frete_vendedor_total,
    pp.ads_agg                                                       AS ads_total,
    ROUND(pp.valor_produto_agg * pp.aliquota_imp, 2)                 AS impostos_total,
    pp.outros_descontos_agg                                          AS outros_descontos_total,
    ROUND(
      pp.valor_produto_agg - pp.comissao_agg - pp.tarifa_fixa_agg
      - pp.frete_efetivo - pp.ads_agg
      - (pp.valor_produto_agg * pp.aliquota_imp)
      - pp.outros_descontos_agg,
    2)                                                               AS valor_liquido_calculado,
    COALESCE(ip.qtd_itens, 0)                                        AS qtd_itens,
    ip.cmv_calculado                                                 AS cmv_total,
    CASE
      WHEN ip.cmv_calculado IS NOT NULL THEN
        ROUND(
          pp.valor_produto_agg - pp.comissao_agg - pp.tarifa_fixa_agg
          - pp.frete_efetivo - pp.ads_agg
          - (pp.valor_produto_agg * pp.aliquota_imp)
          - pp.outros_descontos_agg - ip.cmv_calculado,
        2)
      ELSE NULL
    END                                                              AS margem_contribuicao,
    (ip.cmv_calculado IS NOT NULL)                                  AS tem_cmv,
    ip.primeiro_anuncio_id,
    COALESCE(ip.anuncio_ids_arr, ARRAY[]::text[])                   AS anuncio_ids
  FROM pedidos_paginados pp
  JOIN empresas e ON e.id = pp.empresa_id
  LEFT JOIN itens_paginados ip
    ON ip.ped_key    = pp.ped_key
   AND ip.empresa_id = pp.empresa_id
  -- Filtro de custo aplicado aqui (pós-join com itens)
  WHERE (
    p_tem_custo IS NULL
    OR (p_tem_custo = 'com_custo' AND ip.cmv_calculado IS NOT NULL)
    OR (p_tem_custo = 'sem_custo' AND ip.cmv_calculado IS NULL)
  )
  ORDER BY pp.data_pedido DESC, pp.ped_key;
END;
$$;
