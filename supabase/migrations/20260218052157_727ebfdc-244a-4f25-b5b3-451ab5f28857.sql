
-- Nova tabela: custo logístico por empresa + canal + tipo_envio
CREATE TABLE IF NOT EXISTS public.logistica_plataforma_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  canal text NOT NULL, -- 'Mercado Livre' | 'Shopee'
  tipo_envio text NOT NULL, -- 'flex' | 'flex_turbo'
  custo numeric NOT NULL DEFAULT 0,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, canal, tipo_envio)
);

ALTER TABLE public.logistica_plataforma_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logistica_plataforma_config"
  ON public.logistica_plataforma_config FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own logistica_plataforma_config"
  ON public.logistica_plataforma_config FOR INSERT
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own logistica_plataforma_config"
  ON public.logistica_plataforma_config FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own logistica_plataforma_config"
  ON public.logistica_plataforma_config FOR DELETE
  USING (user_has_empresa_access(empresa_id));

-- Migrar dados existentes de empresa_logistica_config → nova tabela (Mercado Livre)
INSERT INTO public.logistica_plataforma_config (empresa_id, canal, tipo_envio, custo)
SELECT empresa_id, 'Mercado Livre', 'flex', flex_custo
FROM public.empresa_logistica_config
WHERE flex_custo > 0
ON CONFLICT (empresa_id, canal, tipo_envio) DO NOTHING;

INSERT INTO public.logistica_plataforma_config (empresa_id, canal, tipo_envio, custo)
SELECT empresa_id, 'Mercado Livre', 'flex_turbo', flex_turbo_custo
FROM public.empresa_logistica_config
WHERE flex_turbo_custo > 0
ON CONFLICT (empresa_id, canal, tipo_envio) DO NOTHING;

-- Atualizar RPC get_vendas_por_pedido para usar a nova tabela por canal
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 50,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamptz,
  data_repasse timestamptz,
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
  valor_liquido numeric,
  cmv_total numeric,
  margem_contribuicao numeric,
  margem_contribuicao_pct numeric,
  qtd_itens integer,
  primeiro_anuncio_id text,
  anuncio_ids text[],
  tem_custo boolean,
  fonte_custo text
)
LANGUAGE plpgsql
SECURITY DEFINER
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
        WHEN bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0)
        THEN SUM(mti.quantidade * COALESCE(NULLIF(p.custo_medio, 0), NULLIF(sc.custo_unitario, 0)))
        ELSE NULL
      END AS cmv_total,
      bool_and(COALESCE(p.custo_medio, 0) > 0 OR COALESCE(sc.custo_unitario, 0) > 0) AS tem_cmv,
      CASE
        WHEN bool_and(COALESCE(p.custo_medio, 0) > 0) THEN 'produto'
        WHEN bool_and(COALESCE(sc.custo_unitario, 0) > 0) THEN 'sku_costs'
        ELSE 'nao_encontrado'
      END AS fonte_custo_raw,
      (array_agg(DISTINCT mti.anuncio_id ORDER BY mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL))[1] AS primeiro_anuncio_id,
      ARRAY(SELECT DISTINCT unnest(array_agg(mti.anuncio_id) FILTER (WHERE mti.anuncio_id IS NOT NULL)) LIMIT 3) AS anuncio_ids
    FROM marketplace_transaction_items mti
    JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
    LEFT JOIN produtos p ON p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0
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
        + COALESCE(vb.bonus_envio_agg, 0)
        - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        - COALESCE((
            SELECT lpc.custo FROM logistica_plataforma_config lpc
            WHERE lpc.empresa_id = vb.empresa_id
              AND lpc.canal = vb.canal
              AND lpc.tipo_envio = vb.tipo_envio
            LIMIT 1
          ), 0)
      , 2) AS valor_liquido,
      ia.cmv_total,
      ROUND(
        vb.valor_produto
        - COALESCE(vb.comissao_agg, 0)
        - COALESCE(vb.tarifa_fixa_agg, 0)
        - COALESCE(vb.frete_vendedor_agg, 0)
        + COALESCE(vb.bonus_envio_agg, 0)
        - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
        - COALESCE(ia.cmv_total, 0)
        - COALESCE((
            SELECT lpc.custo FROM logistica_plataforma_config lpc
            WHERE lpc.empresa_id = vb.empresa_id
              AND lpc.canal = vb.canal
              AND lpc.tipo_envio = vb.tipo_envio
            LIMIT 1
          ), 0)
      , 2) AS margem_contribuicao,
      CASE
        WHEN vb.valor_produto > 0 AND ia.cmv_total IS NOT NULL THEN
          ROUND(
            (
              vb.valor_produto
              - COALESCE(vb.comissao_agg, 0)
              - COALESCE(vb.tarifa_fixa_agg, 0)
              - COALESCE(vb.frete_vendedor_agg, 0)
              + COALESCE(vb.bonus_envio_agg, 0)
              - ROUND(vb.valor_produto * COALESCE(cf.aliquota_imposto, 6.0) / 100.0, 2)
              - COALESCE(ia.cmv_total, 0)
              - COALESCE((
                  SELECT lpc.custo FROM logistica_plataforma_config lpc
                  WHERE lpc.empresa_id = vb.empresa_id
                    AND lpc.canal = vb.canal
                    AND lpc.tipo_envio = vb.tipo_envio
                  LIMIT 1
                ), 0)
            ) / vb.valor_produto * 100.0
          , 1)
        ELSE NULL
      END AS margem_contribuicao_pct,
      COALESCE(ia.qtd_itens, 0)::integer AS qtd_itens,
      ia.primeiro_anuncio_id,
      COALESCE(ia.anuncio_ids, ARRAY[]::text[]) AS anuncio_ids,
      COALESCE(ia.tem_cmv, false) AS tem_custo,
      COALESCE(ia.fonte_custo_raw, 'nao_encontrado') AS fonte_custo
    FROM vendas_base vb
    LEFT JOIN config_fiscal cf ON cf.empresa_id = vb.empresa_id
    LEFT JOIN itens_agg ia ON ia.grp_pedido_id = vb.grp_pedido_id AND ia.empresa_id = vb.empresa_id
  )
  SELECT r.*
  FROM resultado r
  WHERE
    (p_busca IS NULL OR r.pedido_id ILIKE '%' || p_busca || '%')
    AND (
      p_tem_custo IS NULL
      OR (p_tem_custo = 'com_custo' AND r.tem_custo = true)
      OR (p_tem_custo = 'sem_custo' AND r.tem_custo = false)
    )
  ORDER BY r.data_pedido DESC
  LIMIT p_page_size
  OFFSET p_page * p_page_size;
END;
$$;
