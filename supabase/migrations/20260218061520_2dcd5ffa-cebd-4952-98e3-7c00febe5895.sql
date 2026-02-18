
-- Reescreve get_vendas_por_pedido com performance otimizada (evita subqueries correlated lentas)
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
  v_empresa_ids     uuid[];
  v_data_inicio     timestamptz;
  v_data_fim        timestamptz;
BEGIN
  -- Resolver empresas acessíveis
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id)
    INTO v_empresa_ids
    FROM user_empresas ue
    WHERE ue.user_id = auth.uid();
  END IF;

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Converter datas
  v_data_inicio := (p_data_inicio::date)::timestamptz + interval '3 hours';
  v_data_fim    := (p_data_fim::date + interval '1 day')::timestamptz + interval '3 hours';

  RETURN QUERY
  WITH
  -- 1. Agregar transações por pedido (usa COALESCE pack_id para agrupar corretamente)
  tx_agrupadas AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id)           AS ped_key,
      mt.empresa_id,
      MIN(mt.data_transacao)                        AS data_pedido,
      MAX(mt.data_repasse)                          AS data_repasse,
      (array_agg(mt.status ORDER BY mt.data_transacao DESC))[1] AS status,
      mt.tipo_envio,
      mt.canal,
      mt.conta_nome,
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

  -- 2. Custo de logística por empresa/tipo_envio (join direto, sem subquery por linha)
  logistica AS (
    SELECT lpc.empresa_id, lpc.tipo_envio, lpc.custo
    FROM logistica_plataforma_config lpc
    WHERE lpc.empresa_id = ANY(v_empresa_ids)
  ),

  -- 3. Frete efetivo calculado
  tx_com_frete AS (
    SELECT
      ta.*,
      CASE
        WHEN ta.tipo_envio IN ('flex', 'flex_turbo') THEN
          GREATEST(0, COALESCE(l.custo, 0) - ta.bonus_envio_agg)
        ELSE
          ta.frete_vendedor_api
      END AS frete_efetivo
    FROM tx_agrupadas ta
    LEFT JOIN logistica l
      ON l.empresa_id = ta.empresa_id
     AND l.tipo_envio = ta.tipo_envio
  ),

  -- 4. Alíquotas fiscais por empresa
  aliquotas AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas / 100.0 AS aliquota
    FROM empresas_config_fiscal ecf
    WHERE ecf.empresa_id = ANY(v_empresa_ids)
  ),

  -- 5. Itens e CMV via sku_costs (evita join pesado em produtos)
  itens_agg AS (
    SELECT
      COALESCE(mt2.pack_id, mt2.pedido_id) AS ped_key,
      mt2.empresa_id,
      SUM(mti.quantidade)                   AS qtd_itens,
      -- Tenta sku_costs primeiro (mais simples e rápido)
      SUM(
        CASE
          WHEN sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0
          THEN mti.quantidade * sc.custo_unitario
          WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0
          THEN mti.quantidade * p.custo_medio
          ELSE NULL
        END
      )                                     AS cmv_calculado,
      -- Para anúncios (apenas os primeiros 3 distintos)
      (array_agg(mti.anuncio_id ORDER BY mti.created_at)
        FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      array_agg(DISTINCT mti.anuncio_id)
        FILTER (WHERE mti.anuncio_id IS NOT NULL) AS anuncio_ids_arr
    FROM marketplace_transactions mt2
    JOIN marketplace_transaction_items mti ON mti.transaction_id = mt2.id
    LEFT JOIN sku_costs sc
      ON sc.sku = mti.sku_marketplace
     AND sc.empresa_id = mt2.empresa_id
    LEFT JOIN produtos p
      ON p.id = mti.produto_id
     AND COALESCE(p.custo_medio, 0) > 0
    WHERE mt2.empresa_id = ANY(v_empresa_ids)
      AND mt2.tipo_transacao = 'venda'
      AND mt2.data_transacao >= v_data_inicio
      AND mt2.data_transacao <  v_data_fim
    GROUP BY COALESCE(mt2.pack_id, mt2.pedido_id), mt2.empresa_id
  ),

  -- 6. Aplicar paginação e filtro p_tem_custo aqui (depois de join com itens)
  resultado_final AS (
    SELECT
      tcf.ped_key,
      tcf.empresa_id,
      tcf.data_pedido,
      tcf.data_repasse,
      tcf.status,
      tcf.tipo_envio,
      tcf.canal,
      tcf.conta_nome,
      tcf.valor_produto_agg,
      tcf.comissao_agg,
      tcf.tarifa_fixa_agg,
      tcf.frete_efetivo,
      tcf.ads_agg,
      tcf.outros_descontos_agg,
      COALESCE(a.aliquota, 0.06)            AS aliquota_imp,
      COALESCE(ia.qtd_itens, 0)             AS qtd_itens,
      ia.cmv_calculado,
      ia.primeiro_anuncio_id,
      ia.anuncio_ids_arr
    FROM tx_com_frete tcf
    LEFT JOIN aliquotas a   ON a.empresa_id   = tcf.empresa_id
    LEFT JOIN itens_agg ia  ON ia.ped_key     = tcf.ped_key
                           AND ia.empresa_id   = tcf.empresa_id
    WHERE (
      p_tem_custo IS NULL
      OR (p_tem_custo = 'com_custo' AND ia.cmv_calculado IS NOT NULL)
      OR (p_tem_custo = 'sem_custo' AND ia.cmv_calculado IS NULL)
    )
  )

  SELECT
    rf.ped_key                                                         AS pedido_id,
    rf.empresa_id,
    e.nome_fantasia                                                     AS empresa_nome_fantasia,
    rf.canal,
    rf.conta_nome,
    rf.data_pedido,
    rf.data_repasse,
    rf.status,
    rf.tipo_envio,
    rf.valor_produto_agg                                               AS valor_produto,
    rf.comissao_agg                                                    AS comissao_total,
    rf.tarifa_fixa_agg                                                 AS tarifa_fixa_total,
    rf.frete_efetivo                                                   AS frete_vendedor_total,
    rf.ads_agg                                                         AS ads_total,
    ROUND(rf.valor_produto_agg * rf.aliquota_imp, 2)                   AS impostos_total,
    rf.outros_descontos_agg                                            AS outros_descontos_total,
    ROUND(
      rf.valor_produto_agg
      - rf.comissao_agg
      - rf.tarifa_fixa_agg
      - rf.frete_efetivo
      - rf.ads_agg
      - (rf.valor_produto_agg * rf.aliquota_imp)
      - rf.outros_descontos_agg,
    2)                                                                 AS valor_liquido_calculado,
    rf.qtd_itens,
    rf.cmv_calculado                                                   AS cmv_total,
    CASE
      WHEN rf.cmv_calculado IS NOT NULL THEN
        ROUND(
          rf.valor_produto_agg
          - rf.comissao_agg
          - rf.tarifa_fixa_agg
          - rf.frete_efetivo
          - rf.ads_agg
          - (rf.valor_produto_agg * rf.aliquota_imp)
          - rf.outros_descontos_agg
          - rf.cmv_calculado,
        2)
      ELSE NULL
    END                                                                AS margem_contribuicao,
    (rf.cmv_calculado IS NOT NULL)                                    AS tem_cmv,
    rf.primeiro_anuncio_id,
    COALESCE(rf.anuncio_ids_arr[1:3], ARRAY[]::text[])               AS anuncio_ids
  FROM resultado_final rf
  JOIN empresas e ON e.id = rf.empresa_id
  ORDER BY rf.data_pedido DESC, rf.ped_key
  LIMIT  p_page_size
  OFFSET (p_page * p_page_size);
END;
$$;
