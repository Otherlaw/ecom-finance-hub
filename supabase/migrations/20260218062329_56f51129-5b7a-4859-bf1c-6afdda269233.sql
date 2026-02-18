
-- Corrige cálculo de frete efetivo para pedidos "Coleta Flex" (self_service com bonus_envio > 0)
-- A lógica anterior ignorava o bônus para tipo_envio != flex/flex_turbo
-- A nova lógica: se há bonus_envio_agg > 0 em qualquer tipo, deduz do frete_vendedor_api

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id  uuid    DEFAULT NULL,
  p_data_inicio text    DEFAULT NULL,
  p_data_fim    text    DEFAULT NULL,
  p_canal       text    DEFAULT NULL,
  p_conta       text    DEFAULT NULL,
  p_status      text    DEFAULT NULL,
  p_busca       text    DEFAULT NULL,
  p_tipo_envio  text    DEFAULT NULL,
  p_tem_custo   text    DEFAULT NULL,
  p_page        integer DEFAULT 0,
  p_page_size   integer DEFAULT 50
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
  qtd_itens              numeric,
  cmv_total              numeric,
  margem_contribuicao    numeric,
  tem_cmv                boolean,
  primeiro_anuncio_id    text,
  anuncio_ids            text[]
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
  -- CORRIGIDO: pedidos self_service (Coleta) com bonus_envio_agg > 0 também deduzem o bônus
  pedidos_frete AS (
    SELECT
      pb.*,
      CASE
        WHEN pb.tipo_envio IN ('flex', 'flex_turbo') THEN
          -- Flex/Flex Turbo: custo operacional configurado - bônus ML
          GREATEST(0,
            COALESCE((
              SELECT lpc.custo FROM logistica_plataforma_config lpc
              WHERE lpc.empresa_id = pb.empresa_id AND lpc.tipo_envio = pb.tipo_envio
              LIMIT 1
            ), 0) - pb.bonus_envio_agg
          )
        WHEN pb.bonus_envio_agg > 0 THEN
          -- Coleta Flex (self_service com subsídio ML): frete real da API - bônus
          GREATEST(0, pb.frete_vendedor_api - pb.bonus_envio_agg)
        ELSE
          -- Full / Coleta sem bônus: frete real da API diretamente
          pb.frete_vendedor_api
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

  -- PASSO 5: Itens + CMV apenas dos pedidos paginados
  item_cmv AS (
    SELECT
      tip.ped_key,
      tip.empresa_id,
      SUM(COALESCE(mti.quantidade, 0))::numeric AS qtd_itens,
      -- Custo: prioridade produto.custo_medio > mapeamento > sku direto > sku_costs
      SUM(
        COALESCE(mti.quantidade, 0) * COALESCE(
          NULLIF(p_direct.custo_medio, 0),
          NULLIF(p_mapped.custo_medio, 0),
          NULLIF(p_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0),
          0
        )
      )::numeric AS cmv_total,
      BOOL_OR(
        COALESCE(
          NULLIF(p_direct.custo_medio, 0),
          NULLIF(p_mapped.custo_medio, 0),
          NULLIF(p_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0)
        ) IS NOT NULL
      ) AS tem_cmv,
      -- Anúncio IDs para thumbnails
      (ARRAY_AGG(mti.anuncio_id ORDER BY mti.anuncio_id NULLS LAST) FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      ARRAY(
        SELECT DISTINCT unnest(ARRAY_AGG(mti2.anuncio_id) FILTER (WHERE mti2.anuncio_id IS NOT NULL))
        FROM marketplace_transaction_items mti2
        WHERE mti2.transaction_id = ANY(ARRAY_AGG(tip.tx_id))
        LIMIT 3
      ) AS anuncio_ids_arr
    FROM tx_ids_paginados tip
    JOIN marketplace_transaction_items mti ON mti.transaction_id = tip.tx_id
    -- Custo por produto_id direto
    LEFT JOIN produtos p_direct ON p_direct.id = mti.produto_id
    -- Custo via mapeamento produto_marketplace_map
    LEFT JOIN produto_marketplace_map pmm
      ON pmm.sku_marketplace = mti.sku_marketplace
     AND pmm.empresa_id = tip.empresa_id
     AND pmm.ativo = true
     AND mti.produto_id IS NULL
    LEFT JOIN produtos p_mapped ON p_mapped.id = pmm.produto_id
    -- Custo via sku direto em produtos
    LEFT JOIN produtos p_sku
      ON p_sku.sku = mti.sku_marketplace
     AND p_sku.empresa_id = tip.empresa_id
     AND mti.produto_id IS NULL
     AND pmm.produto_id IS NULL
    -- Custo via sku_costs
    LEFT JOIN sku_costs sc
      ON sc.sku = mti.sku_marketplace
     AND sc.empresa_id = tip.empresa_id
    GROUP BY tip.ped_key, tip.empresa_id
  )

  -- SELEÇÃO FINAL
  SELECT
    pp.ped_key                                          AS pedido_id,
    pp.empresa_id,
    e.nome_fantasia                                     AS empresa_nome_fantasia,
    pp.canal,
    pp.conta_nome,
    pp.data_pedido,
    pp.data_repasse,
    pp.status,
    pp.tipo_envio,
    pp.valor_produto_agg                                AS valor_produto,
    pp.comissao_agg                                     AS comissao_total,
    pp.tarifa_fixa_agg                                  AS tarifa_fixa_total,
    pp.frete_efetivo                                    AS frete_vendedor_total,
    pp.ads_agg                                          AS ads_total,
    ROUND(pp.valor_produto_agg * pp.aliquota_imp, 2)   AS impostos_total,
    pp.outros_descontos_agg                             AS outros_descontos_total,
    -- Valor líquido usando frete efetivo (com bônus já deduzido)
    ROUND(
      pp.valor_produto_agg
      - pp.comissao_agg
      - pp.tarifa_fixa_agg
      - pp.frete_efetivo
      - pp.ads_agg
      - (pp.valor_produto_agg * pp.aliquota_imp)
      - pp.outros_descontos_agg,
      2
    )                                                   AS valor_liquido_calculado,
    COALESCE(ic.qtd_itens, 0)                          AS qtd_itens,
    CASE WHEN ic.tem_cmv THEN ic.cmv_total ELSE NULL END AS cmv_total,
    -- Margem = Valor Líquido - CMV (só quando tem CMV)
    CASE
      WHEN ic.tem_cmv THEN
        ROUND(
          pp.valor_produto_agg
          - pp.comissao_agg
          - pp.tarifa_fixa_agg
          - pp.frete_efetivo
          - pp.ads_agg
          - (pp.valor_produto_agg * pp.aliquota_imp)
          - pp.outros_descontos_agg
          - ic.cmv_total,
          2
        )
      ELSE NULL
    END                                                  AS margem_contribuicao,
    COALESCE(ic.tem_cmv, false)                         AS tem_cmv,
    ic.primeiro_anuncio_id,
    COALESCE(ic.anuncio_ids_arr, ARRAY[]::text[])       AS anuncio_ids
  FROM pedidos_paginados pp
  LEFT JOIN item_cmv ic ON ic.ped_key = pp.ped_key AND ic.empresa_id = pp.empresa_id
  LEFT JOIN empresas e  ON e.id = pp.empresa_id;

END;
$$;
