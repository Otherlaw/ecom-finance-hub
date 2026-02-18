
-- ============================================================
-- CORREÇÃO: Frete Flex por Canal nas RPCs de Vendas
-- Problema: frete_vendedor_total mostrava custo da Shopee (9,90)
--           em pedidos Flex do ML, pois a antiga config_logistica
--           não filtrava por canal.
-- Solução:  usar logistica_plataforma_config com JOIN por
--           (empresa_id, canal, tipo_envio) em ambas as RPCs.
-- ============================================================

-- ============================================================
-- 1) Corrigir get_vendas_por_pedido (versão TEXT params — usada pelo hook)
-- ============================================================
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
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  pedido_id             text,
  empresa_id            uuid,
  empresa_nome_fantasia text,
  canal                 text,
  conta_nome            text,
  data_pedido           timestamptz,
  data_repasse          date,
  status                text,
  tipo_envio            text,
  valor_produto         numeric,
  comissao_total        numeric,
  tarifa_fixa_total     numeric,
  frete_vendedor_total  numeric,
  ads_total             numeric,
  impostos_total        numeric,
  outros_descontos_total numeric,
  rebate_total          numeric,
  bonus_envio_total     numeric,
  valor_liquido_calculado numeric,
  qtd_itens             numeric,
  cmv_total             numeric,
  margem_contribuicao   numeric,
  tem_cmv               boolean,
  primeiro_anuncio_id   text,
  anuncio_ids           text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_ids  uuid[];
  v_data_inicio  timestamptz;
  v_data_fim     timestamptz;
BEGIN
  -- Resolver empresa_ids com controle de acesso
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id) INTO v_empresa_ids
    FROM user_empresas ue WHERE ue.user_id = auth.uid();
  END IF;

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN RETURN; END IF;

  -- Converter datas TEXT para timestamptz (fuso BR UTC-3)
  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  END IF;
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';
  END IF;

  RETURN QUERY
  WITH vendas_base AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id)             AS grp_pedido_id,
      mt.empresa_id,
      e.nome_fantasia,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao)                          AS data_pedido,
      MAX(mt.data_repasse)                            AS data_repasse,
      MAX(mt.status)                                  AS status,
      MAX(mt.tipo_envio)                              AS tipo_envio,
      SUM(COALESCE(mt.valor_bruto, 0))                AS valor_produto,
      CASE WHEN bool_and(mt.taxas IS NOT NULL)
           THEN SUM(COALESCE(mt.taxas, 0))           ELSE NULL END AS comissao_agg,
      CASE WHEN bool_and(mt.tarifas IS NOT NULL)
           THEN SUM(COALESCE(mt.tarifas, 0))         ELSE NULL END AS tarifa_fixa_agg,
      CASE WHEN bool_and(mt.frete_vendedor IS NOT NULL)
           THEN SUM(COALESCE(mt.frete_vendedor, 0))  ELSE NULL END AS frete_vendedor_agg,
      SUM(COALESCE(mt.custo_ads, 0))                  AS ads_total,
      SUM(COALESCE(mt.rebate, 0))                     AS rebate_agg,
      SUM(COALESCE(mt.bonus_envio, 0))                AS bonus_envio_agg,
      SUM(COALESCE(mt.outros_descontos, 0))           AS outros_descontos_agg
    FROM marketplace_transactions mt
    JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim    IS NULL OR mt.data_transacao <  v_data_fim)
      AND (p_canal      IS NULL OR mt.canal      ILIKE p_canal)
      AND (p_conta      IS NULL OR mt.conta_nome ILIKE p_conta)
      AND (p_status     IS NULL OR mt.status     =     p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio =     p_tipo_envio)
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  ),
  -- Configuração fiscal por empresa
  config_fiscal AS (
    SELECT ecf.empresa_id, COALESCE(ecf.aliquota_imposto_vendas, 6.0) AS aliquota_imposto
    FROM empresas_config_fiscal ecf
    WHERE ecf.empresa_id = ANY(v_empresa_ids)
  ),
  -- Custo de logística por empresa + canal + tipo_envio (correto: filtra por canal)
  config_logistica_plataforma AS (
    SELECT lpc.empresa_id, lpc.canal, lpc.tipo_envio, lpc.custo
    FROM logistica_plataforma_config lpc
    WHERE lpc.empresa_id = ANY(v_empresa_ids)
  ),
  -- Itens agregados por pedido (CMV com prioridade: custo_medio > sku_costs)
  itens_agg AS (
    SELECT
      COALESCE(mt2.pack_id, mt2.pedido_id)  AS grp_pedido_id,
      mt2.empresa_id,
      SUM(mti.quantidade)                   AS qtd_itens,
      CASE
        WHEN bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0)
        THEN SUM(mti.quantidade * COALESCE(NULLIF(p.custo_medio, 0), NULLIF(sc.custo_unitario, 0)))
        ELSE NULL
      END AS cmv_total,
      bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0) AS tem_cmv,
      (array_agg(DISTINCT mti.anuncio_id ORDER BY mti.anuncio_id)
         FILTER (WHERE mti.anuncio_id IS NOT NULL))[1]                                 AS primeiro_anuncio_id,
      ARRAY(SELECT DISTINCT unnest(array_agg(mti.anuncio_id)
            FILTER (WHERE mti.anuncio_id IS NOT NULL)) LIMIT 3)                        AS anuncio_ids
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
    -- Prioridade 1: custo via produto_id
    LEFT JOIN produtos p  ON p.id  = mti.produto_id          AND COALESCE(p.custo_medio, 0) > 0
    -- Prioridade 2: custo via sku_marketplace (fallback)
    LEFT JOIN sku_costs sc ON sc.sku = mti.sku_marketplace   AND sc.empresa_id = mt2.empresa_id
    WHERE mt2.empresa_id = ANY(v_empresa_ids)
      AND mt2.tipo_transacao = 'venda'
      AND (v_data_inicio IS NULL OR mt2.data_transacao >= v_data_inicio)
      AND (v_data_fim    IS NULL OR mt2.data_transacao <  v_data_fim)
    GROUP BY COALESCE(mt2.pack_id, mt2.pedido_id), mt2.empresa_id
  ),
  resultado AS (
    SELECT
      vb.grp_pedido_id                      AS pedido_id,
      vb.empresa_id,
      vb.nome_fantasia                      AS empresa_nome_fantasia,
      vb.canal,
      vb.conta_nome,
      vb.data_pedido,
      vb.data_repasse,
      vb.status,
      vb.tipo_envio,
      vb.valor_produto,
      vb.comissao_agg                       AS comissao_total,
      vb.tarifa_fixa_agg                    AS tarifa_fixa_total,
      -- CORREÇÃO PRINCIPAL: frete_vendedor por canal e tipo_envio
      CASE
        -- Se veio da API (não NULL), usar o valor real
        WHEN vb.frete_vendedor_agg IS NOT NULL THEN vb.frete_vendedor_agg
        -- Flex/Flex Turbo sem frete da API: aplicar custo configurado menos bônus recebido
        WHEN vb.tipo_envio IN ('flex', 'flex_turbo') THEN
          GREATEST(0, COALESCE(lpc.custo, 0) - COALESCE(vb.bonus_envio_agg, 0))
        ELSE NULL
      END                                   AS frete_vendedor_total,
      vb.ads_total,
      -- Imposto calculado sobre valor bruto com alíquota por empresa
      ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2) AS impostos_total,
      vb.outros_descontos_agg               AS outros_descontos_total,
      vb.rebate_agg                         AS rebate_total,
      vb.bonus_envio_agg                    AS bonus_envio_total,
      -- Valor líquido calculado (usando frete já resolvido)
      vb.valor_produto
        - COALESCE(vb.comissao_agg, 0)
        - COALESCE(vb.tarifa_fixa_agg, 0)
        - CASE
            WHEN vb.frete_vendedor_agg IS NOT NULL THEN vb.frete_vendedor_agg
            WHEN vb.tipo_envio IN ('flex', 'flex_turbo') THEN
              GREATEST(0, COALESCE(lpc.custo, 0) - COALESCE(vb.bonus_envio_agg, 0))
            ELSE 0
          END
        - COALESCE(vb.ads_total, 0)
        - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        - COALESCE(vb.outros_descontos_agg, 0)
        + COALESCE(vb.rebate_agg, 0)
        + COALESCE(vb.bonus_envio_agg, 0)
      AS valor_liquido_calculado,
      COALESCE(ia.qtd_itens, 0)            AS qtd_itens,
      ia.cmv_total,
      -- Margem de contribuição: NULL se CMV não disponível
      CASE
        WHEN ia.cmv_total IS NOT NULL THEN
          vb.valor_produto
            - COALESCE(vb.comissao_agg, 0)
            - COALESCE(vb.tarifa_fixa_agg, 0)
            - CASE
                WHEN vb.frete_vendedor_agg IS NOT NULL THEN vb.frete_vendedor_agg
                WHEN vb.tipo_envio IN ('flex', 'flex_turbo') THEN
                  GREATEST(0, COALESCE(lpc.custo, 0) - COALESCE(vb.bonus_envio_agg, 0))
                ELSE 0
              END
            - COALESCE(vb.ads_total, 0)
            - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
            - COALESCE(vb.outros_descontos_agg, 0)
            + COALESCE(vb.rebate_agg, 0)
            + COALESCE(vb.bonus_envio_agg, 0)
            - ia.cmv_total
        ELSE NULL
      END                                   AS margem_contribuicao,
      COALESCE(ia.tem_cmv, false)           AS tem_cmv,
      ia.primeiro_anuncio_id,
      COALESCE(ia.anuncio_ids, ARRAY[]::text[]) AS anuncio_ids
    FROM vendas_base vb
    LEFT JOIN config_fiscal cf ON cf.empresa_id = vb.empresa_id
    -- JOIN filtrado por canal E tipo_envio para pegar o custo correto
    LEFT JOIN config_logistica_plataforma lpc
      ON  lpc.empresa_id = vb.empresa_id
      AND lpc.canal      = vb.canal
      AND lpc.tipo_envio = vb.tipo_envio
    LEFT JOIN itens_agg ia
      ON  ia.grp_pedido_id = vb.grp_pedido_id
      AND ia.empresa_id    = vb.empresa_id
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
$$;

-- ============================================================
-- 2) Corrigir get_vendas_por_pedido_resumo_v2
--    Substituir empresa_logistica_config (sem filtro canal) por
--    logistica_plataforma_config (filtrado por canal + tipo_envio)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo_v2(
  p_empresa_id  uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim    text DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos            bigint,
  total_itens              numeric,
  valor_produto_total      numeric,
  comissao_total           numeric,
  tarifa_fixa_total        numeric,
  frete_vendedor_total     numeric,
  ads_total                numeric,
  impostos_total           numeric,
  valor_liquido_total      numeric,
  cmv_total                numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv          bigint,
  pedidos_sem_cmv          bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_inicio      timestamptz;
  v_data_fim         timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();

  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  IF p_empresa_id IS NOT NULL AND NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::bigint, 0::bigint;
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
      mt.canal,
      mt.tipo_envio,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.outros_descontos,
      mt.valor_liquido,
      COALESCE(mt.rebate, 0)      AS rebate,
      COALESCE(mt.bonus_envio, 0) AS bonus_envio,
      mt.id                       AS tx_id
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao   = 'venda'
      AND mt.tipo_lancamento  = 'credito'
      AND (v_data_inicio IS NULL OR mt.data_transacao >= v_data_inicio)
      AND (v_data_fim    IS NULL OR mt.data_transacao <  v_data_fim)
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
  -- CORREÇÃO: usar logistica_plataforma_config filtrada por canal e tipo_envio
  config_logistica AS (
    SELECT lpc.empresa_id, lpc.canal, lpc.tipo_envio, lpc.custo
    FROM logistica_plataforma_config lpc
    WHERE lpc.empresa_id = ANY(v_user_empresa_ids)
  ),
  itens_por_tx AS (
    SELECT
      mti.transaction_id,
      SUM(mti.quantidade)                                                   AS qtd,
      SUM(CASE WHEN p.custo_medio > 0 THEN mti.quantidade * p.custo_medio ELSE 0 END) AS cmv,
      BOOL_OR(p.custo_medio IS NOT NULL AND p.custo_medio > 0)             AS has_cmv
    FROM marketplace_transaction_items mti
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mti.transaction_id IN (SELECT tx_id FROM vendas)
    GROUP BY mti.transaction_id
  ),
  agregado AS (
    SELECT
      v.group_key,
      v.empresa_id,
      v.canal,
      MAX(v.tipo_envio)                      AS tipo_envio,
      SUM(COALESCE(v.valor_bruto, 0))        AS val_bruto,
      SUM(COALESCE(v.taxas, 0))              AS taxas_sum,
      SUM(COALESCE(v.tarifas, 0))            AS tarifas_sum,
      -- frete da API (NULL quando não veio)
      CASE WHEN bool_and(v.frete_vendedor IS NOT NULL)
           THEN SUM(COALESCE(v.frete_vendedor, 0)) ELSE NULL END AS frete_v_sum_api,
      SUM(COALESCE(v.custo_ads, 0))          AS ads_sum,
      SUM(COALESCE(v.outros_descontos, 0))   AS desc_sum,
      SUM(v.rebate)                          AS rebate_sum,
      SUM(v.bonus_envio)                     AS bonus_envio_sum,
      COALESCE(SUM(ipt.qtd), 0)             AS qtd_sum,
      SUM(COALESCE(ipt.cmv, 0))             AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    GROUP BY v.group_key, v.empresa_id, v.canal
  ),
  -- Calcular o frete efetivo por pedido agregado (com ou sem config)
  agregado_com_frete AS (
    SELECT
      a.*,
      -- frete efetivo: API > config_logistica por canal - bonus
      CASE
        WHEN a.frete_v_sum_api IS NOT NULL THEN a.frete_v_sum_api
        WHEN a.tipo_envio IN ('flex', 'flex_turbo') THEN
          GREATEST(0, COALESCE(cl.custo, 0) - a.bonus_envio_sum)
        ELSE 0
      END AS frete_efetivo
    FROM agregado a
    LEFT JOIN config_logistica cl
      ON  cl.empresa_id = a.empresa_id
      AND cl.canal      = a.canal
      AND cl.tipo_envio = a.tipo_envio
  )
  SELECT
    COUNT(*)::bigint,
    SUM(acf.qtd_sum),
    SUM(acf.val_bruto),
    SUM(acf.taxas_sum),
    SUM(acf.tarifas_sum),
    SUM(acf.frete_efetivo),
    SUM(acf.ads_sum),
    SUM(ROUND(acf.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)),
    SUM(
      acf.val_bruto - acf.taxas_sum - acf.tarifas_sum - acf.frete_efetivo
      + acf.rebate_sum + acf.bonus_envio_sum - acf.desc_sum
      - ROUND(acf.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
    ),
    SUM(acf.cmv_sum),
    SUM(CASE WHEN acf.has_cmv THEN
      acf.val_bruto - acf.taxas_sum - acf.tarifas_sum - acf.frete_efetivo
      + acf.rebate_sum + acf.bonus_envio_sum - acf.desc_sum
      - ROUND(acf.val_bruto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
      - acf.cmv_sum
    ELSE 0 END),
    COUNT(*) FILTER (WHERE acf.has_cmv)::bigint,
    COUNT(*) FILTER (WHERE NOT acf.has_cmv)::bigint
  FROM agregado_com_frete acf
  LEFT JOIN config_fiscal cf ON cf.empresa_id = acf.empresa_id;
END;
$$;
