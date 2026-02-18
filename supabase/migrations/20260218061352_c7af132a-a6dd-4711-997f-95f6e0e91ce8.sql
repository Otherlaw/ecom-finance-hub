
-- Recria get_vendas_por_pedido com assinatura única (TEXT para datas) e lógica correta de frete
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
  -- Resolver empresas acessíveis ao usuário
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_ids := ARRAY[p_empresa_id];
  ELSE
    SELECT array_agg(ue.empresa_id)
    INTO v_empresa_ids
    FROM user_empresas ue
    WHERE ue.user_id = auth.uid();
  END IF;

  -- Converter datas TEXT → timestamptz
  v_data_inicio := (p_data_inicio::date)::timestamptz;
  v_data_fim    := (p_data_fim::date + interval '1 day')::timestamptz;

  RETURN QUERY
  WITH vendas_base AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao)                        AS data_pedido,
      MAX(mt.data_repasse)                          AS data_repasse,
      -- Status: usar o status mais recente da venda (não pendente_sync)
      (array_agg(mt.status ORDER BY mt.data_transacao DESC))[1] AS status,
      mt.tipo_envio,
      -- Valor bruto (soma de valor_bruto positivos)
      COALESCE(SUM(CASE WHEN mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto_agg,
      -- Comissão = taxas (CV)
      COALESCE(SUM(mt.taxas), 0)                    AS comissao_agg,
      -- Tarifa fixa = tarifas (FINANCING_FEE, etc)
      COALESCE(SUM(mt.tarifas), 0)                  AS tarifa_fixa_agg,
      -- Frete vendedor bruto da API (CXE)
      COALESCE(SUM(mt.frete_vendedor), 0)           AS frete_vendedor_api,
      -- Bônus de envio (subsídio recebido do marketplace)
      COALESCE(SUM(mt.bonus_envio), 0)              AS bonus_envio_agg,
      -- Ads
      COALESCE(SUM(mt.custo_ads), 0)                AS ads_agg,
      -- Outros descontos
      COALESCE(SUM(mt.outros_descontos), 0)         AS outros_descontos_agg
    FROM marketplace_transactions mt
    WHERE mt.empresa_id = ANY(v_empresa_ids)
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <  v_data_fim
      AND mt.tipo_transacao  = 'venda'
      AND (p_canal       IS NULL OR mt.canal      ILIKE p_canal)
      AND (p_conta       IS NULL OR mt.conta_nome ILIKE p_conta)
      AND (p_status      IS NULL OR mt.status     = p_status)
      AND (p_tipo_envio  IS NULL OR mt.tipo_envio = p_tipo_envio)
      AND (p_busca       IS NULL OR mt.pedido_id  ILIKE '%' || p_busca || '%')
    GROUP BY mt.pedido_id, mt.empresa_id, mt.canal, mt.conta_nome, mt.tipo_envio
  ),
  vendas_com_itens AS (
    SELECT
      vb.*,
      COALESCE(SUM(mti.quantidade), 0)              AS qtd_itens_agg,
      -- Primeiro anúncio (para thumbnail)
      (array_agg(mti.anuncio_id ORDER BY mti.created_at)
        FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      -- Array de anúncios distintos (max 3)
      (SELECT array_agg(DISTINCT ai ORDER BY ai)
       FROM unnest(array_agg(mti.anuncio_id)
         FILTER (WHERE mti.anuncio_id IS NOT NULL)) ai
       LIMIT 3)                                     AS anuncio_ids_arr
    FROM vendas_base vb
    LEFT JOIN marketplace_transaction_items mti
      ON mti.transaction_id IN (
          SELECT mt2.id FROM marketplace_transactions mt2
          WHERE mt2.pedido_id = vb.pedido_id
            AND mt2.empresa_id = vb.empresa_id
       )
    GROUP BY
      vb.pedido_id, vb.empresa_id, vb.canal, vb.conta_nome,
      vb.data_pedido, vb.data_repasse, vb.status, vb.tipo_envio,
      vb.valor_produto_agg, vb.comissao_agg, vb.tarifa_fixa_agg,
      vb.frete_vendedor_api, vb.bonus_envio_agg, vb.ads_agg, vb.outros_descontos_agg
  ),
  vendas_com_config AS (
    SELECT
      vci.*,
      -- Custo de logística configurado pela empresa para este tipo de envio
      COALESCE((
        SELECT lpc.custo
        FROM logistica_plataforma_config lpc
        WHERE lpc.empresa_id = vci.empresa_id
          AND lpc.tipo_envio = vci.tipo_envio
        LIMIT 1
      ), 0) AS custo_logistica_config
    FROM vendas_com_itens vci
  ),
  vendas_com_frete AS (
    SELECT
      vcc.*,
      -- LÓGICA DE FRETE:
      -- Flex/Flex Turbo: custo operacional configurado MENOS bônus recebido (nunca negativo)
      -- Full/Coleta/outros: frete real da API sem ajustes
      CASE
        WHEN vcc.tipo_envio IN ('flex', 'flex_turbo') THEN
          GREATEST(0, vcc.custo_logistica_config - vcc.bonus_envio_agg)
        ELSE
          vcc.frete_vendedor_api
      END AS frete_vendedor_efetivo
    FROM vendas_com_config vcc
  ),
  vendas_com_cmv AS (
    SELECT
      vcf.*,
      -- Alíquota de imposto da empresa
      COALESCE((
        SELECT ecf.aliquota_imposto_vendas / 100.0
        FROM empresas_config_fiscal ecf
        WHERE ecf.empresa_id = vcf.empresa_id
        LIMIT 1
      ), 0.06) AS aliquota_imposto,
      -- CMV via sku_costs
      (
        SELECT SUM(sc.custo_unitario * mti2.quantidade)
        FROM marketplace_transaction_items mti2
        JOIN marketplace_transactions mt3
          ON mt3.id = mti2.transaction_id
         AND mt3.pedido_id = vcf.pedido_id
         AND mt3.empresa_id = vcf.empresa_id
        JOIN sku_costs sc
          ON sc.sku = mti2.sku_marketplace
         AND sc.empresa_id = vcf.empresa_id
      ) AS cmv_calculado
    FROM vendas_com_frete vcf
  )
  SELECT
    vc.pedido_id,
    vc.empresa_id,
    e.nome_fantasia                                          AS empresa_nome_fantasia,
    vc.canal,
    vc.conta_nome,
    vc.data_pedido,
    vc.data_repasse,
    vc.status,
    vc.tipo_envio,
    vc.valor_produto_agg                                     AS valor_produto,
    vc.comissao_agg                                          AS comissao_total,
    vc.tarifa_fixa_agg                                       AS tarifa_fixa_total,
    vc.frete_vendedor_efetivo                                AS frete_vendedor_total,
    vc.ads_agg                                               AS ads_total,
    ROUND(vc.valor_produto_agg * vc.aliquota_imposto, 2)    AS impostos_total,
    vc.outros_descontos_agg                                  AS outros_descontos_total,
    -- Valor líquido calculado
    ROUND(
      vc.valor_produto_agg
      - vc.comissao_agg
      - vc.tarifa_fixa_agg
      - vc.frete_vendedor_efetivo
      - vc.ads_agg
      - (vc.valor_produto_agg * vc.aliquota_imposto)
      - vc.outros_descontos_agg,
    2)                                                       AS valor_liquido_calculado,
    vc.qtd_itens_agg                                         AS qtd_itens,
    vc.cmv_calculado                                         AS cmv_total,
    -- Margem de contribuição
    CASE
      WHEN vc.cmv_calculado IS NOT NULL THEN
        ROUND(
          vc.valor_produto_agg
          - vc.comissao_agg
          - vc.tarifa_fixa_agg
          - vc.frete_vendedor_efetivo
          - vc.ads_agg
          - (vc.valor_produto_agg * vc.aliquota_imposto)
          - vc.outros_descontos_agg
          - vc.cmv_calculado,
        2)
      ELSE NULL
    END                                                      AS margem_contribuicao,
    (vc.cmv_calculado IS NOT NULL)                          AS tem_cmv,
    vc.primeiro_anuncio_id,
    COALESCE(vc.anuncio_ids_arr, ARRAY[]::text[])           AS anuncio_ids
  FROM vendas_com_cmv vc
  JOIN empresas e ON e.id = vc.empresa_id
  -- Filtro por custo
  WHERE (
    p_tem_custo IS NULL
    OR (p_tem_custo = 'com_custo'  AND vc.cmv_calculado IS NOT NULL)
    OR (p_tem_custo = 'sem_custo'  AND vc.cmv_calculado IS NULL)
  )
  ORDER BY vc.data_pedido DESC, vc.pedido_id
  LIMIT  p_page_size
  OFFSET (p_page * p_page_size);
END;
$$;
