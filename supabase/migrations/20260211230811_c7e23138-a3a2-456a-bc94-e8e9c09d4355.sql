
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_busca TEXT DEFAULT NULL,
  p_tipo_envio TEXT DEFAULT NULL,
  p_tem_custo TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  pedido_id TEXT,
  empresa_id UUID,
  empresa_nome_fantasia TEXT,
  canal TEXT,
  conta_nome TEXT,
  data_pedido TIMESTAMPTZ,
  data_repasse DATE,
  status TEXT,
  tipo_envio TEXT,
  valor_produto NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  outros_descontos_total NUMERIC,
  valor_liquido_calculado NUMERIC,
  qtd_itens BIGINT,
  cmv_total NUMERIC,
  margem_contribuicao NUMERIC,
  tem_cmv BOOLEAN,
  primeiro_anuncio_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts_inicio TIMESTAMPTZ;
  v_ts_fim TIMESTAMPTZ;
  v_aliquota_imposto NUMERIC;
BEGIN
  -- Converter datas para timestamptz usando fuso Brasil
  v_ts_inicio := date_to_br_timestamptz(p_data_inicio);
  v_ts_fim := date_to_br_timestamptz(p_data_fim + 1);

  -- Obter aliquota de imposto da empresa
  SELECT COALESCE(ecf.aliquota_imposto_vendas, 6)
  INTO v_aliquota_imposto
  FROM empresas_config_fiscal ecf
  WHERE ecf.empresa_id = p_empresa_id;

  IF v_aliquota_imposto IS NULL THEN
    v_aliquota_imposto := 6;
  END IF;

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT mt.pedido_id
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_ts_inicio
      AND mt.data_transacao < v_ts_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_empresa_id IS NOT NULL OR user_has_empresa_access(mt.empresa_id))
      AND (p_canal IS NULL OR mt.canal ILIKE p_canal)
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio ILIKE p_tipo_envio)
      AND (p_busca IS NULL OR (
        mt.pedido_id ILIKE '%' || p_busca || '%'
        OR EXISTS (
          SELECT 1 FROM marketplace_transaction_items mti2
          WHERE mti2.transaction_id = mt.id
            AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti2.descricao_item ILIKE '%' || p_busca || '%')
        )
      ))
  ),
  raw_cmv AS (
    SELECT
      mt.pedido_id AS p_id,
      mt.empresa_id AS e_id,
      SUM(
        COALESCE(
          (SELECT p.custo_medio FROM produto_marketplace_map pmm
           JOIN produtos p ON p.id = pmm.produto_id
           WHERE pmm.sku_marketplace = COALESCE(
             oi->>'seller_custom_field',
             oi->>'seller_sku',
             oi->'item'->>'seller_custom_field',
             oi->'item'->>'seller_sku'
           )
             AND pmm.empresa_id = mt.empresa_id
             AND pmm.ativo = true
           LIMIT 1),
          0
        ) * COALESCE((oi->>'quantity')::int, 1)
      )::numeric AS cmv_raw
    FROM marketplace_transactions mt
    JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN mt.raw_order->'order_items' IS NOT NULL THEN mt.raw_order->'order_items'
        WHEN mt.raw_order->'items' IS NOT NULL THEN mt.raw_order->'items'
        ELSE '[]'::jsonb
      END
    ) AS oi
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_transaction_items mti WHERE mti.transaction_id = mt.id
    )
    GROUP BY mt.pedido_id, mt.empresa_id
  ),
  itens_agregados AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      e.nome_fantasia AS empresa_nome_fantasia,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      MAX(mt.status) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      COALESCE(SUM(
        CASE WHEN mti.id IS NOT NULL
        THEN COALESCE(mti.preco_total, mti.preco_unitario * mti.quantidade, 0)
        ELSE mt.valor_bruto END
      ), 0)::numeric AS valor_produto,
      SUM(COALESCE(mt.taxas, 0))::numeric AS comissao_total,
      SUM(COALESCE(mt.tarifas, 0))::numeric AS tarifa_fixa_total,
      SUM(COALESCE(mt.frete_vendedor, 0))::numeric AS frete_vendedor_total,
      SUM(COALESCE(mt.custo_ads, 0))::numeric AS ads_total,
      SUM(COALESCE(mt.outros_descontos, 0))::numeric AS outros_descontos_total,
      COALESCE(SUM(mti.quantidade), 1)::bigint AS qtd_itens,
      COUNT(mti.id)::bigint AS item_count,
      SUM(
        CASE
          WHEN mti.produto_id IS NOT NULL THEN
            COALESCE((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0) * mti.quantidade
          WHEN mti.sku_marketplace IS NOT NULL THEN
            COALESCE(
              (SELECT p.custo_medio
               FROM produto_marketplace_map pmm
               JOIN produtos p ON p.id = pmm.produto_id
               WHERE pmm.sku_marketplace = mti.sku_marketplace
                 AND pmm.empresa_id = mt.empresa_id
                 AND pmm.ativo = true
               LIMIT 1),
              (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = mt.empresa_id LIMIT 1),
              (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = mt.empresa_id LIMIT 1),
              0
            ) * mti.quantidade
          ELSE 0
        END
      )::numeric AS cmv_itens,
      -- Pegar o primeiro anuncio_id dos itens (ou do raw_order)
      MIN(mti.anuncio_id) AS primeiro_anuncio_id_itens
    FROM marketplace_transactions mt
    JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.tipo_transacao = 'venda'
    GROUP BY mt.pedido_id, mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  ),
  resultado_final AS (
    SELECT
      ia.pedido_id,
      ia.empresa_id,
      ia.empresa_nome_fantasia,
      ia.canal,
      ia.conta_nome,
      ia.data_pedido,
      ia.data_repasse,
      ia.status,
      ia.tipo_envio,
      ia.valor_produto,
      ia.comissao_total,
      ia.tarifa_fixa_total,
      ia.frete_vendedor_total,
      ia.ads_total,
      ROUND(ia.valor_produto * (v_aliquota_imposto / 100), 2) AS impostos_total,
      ia.outros_descontos_total,
      ia.qtd_itens,
      CASE
        WHEN ia.item_count > 0 THEN
          CASE WHEN ia.cmv_itens > 0 THEN ia.cmv_itens ELSE NULL END
        ELSE
          CASE WHEN COALESCE(rc.cmv_raw, 0) > 0 THEN rc.cmv_raw ELSE NULL END
      END AS cmv_total,
      CASE
        WHEN ia.item_count > 0 THEN ia.cmv_itens > 0
        ELSE COALESCE(rc.cmv_raw, 0) > 0
      END AS tem_cmv,
      ia.primeiro_anuncio_id_itens
    FROM itens_agregados ia
    LEFT JOIN raw_cmv rc ON rc.p_id = ia.pedido_id AND rc.e_id = ia.empresa_id
  )
  SELECT
    rf.pedido_id,
    rf.empresa_id,
    rf.empresa_nome_fantasia,
    rf.canal,
    rf.conta_nome,
    rf.data_pedido,
    rf.data_repasse,
    rf.status,
    rf.tipo_envio,
    rf.valor_produto,
    rf.comissao_total,
    rf.tarifa_fixa_total,
    rf.frete_vendedor_total,
    rf.ads_total,
    rf.impostos_total,
    rf.outros_descontos_total,
    (rf.valor_produto - COALESCE(rf.comissao_total, 0) - COALESCE(rf.tarifa_fixa_total, 0)
     - COALESCE(rf.frete_vendedor_total, 0) - rf.ads_total - rf.impostos_total - rf.outros_descontos_total) AS valor_liquido_calculado,
    rf.qtd_itens,
    rf.cmv_total,
    CASE
      WHEN rf.cmv_total IS NOT NULL THEN
        (rf.valor_produto - COALESCE(rf.comissao_total, 0) - COALESCE(rf.tarifa_fixa_total, 0)
         - COALESCE(rf.frete_vendedor_total, 0) - rf.ads_total - rf.impostos_total - rf.outros_descontos_total - rf.cmv_total)
      ELSE NULL
    END AS margem_contribuicao,
    rf.tem_cmv,
    rf.primeiro_anuncio_id_itens AS primeiro_anuncio_id
  FROM resultado_final rf
  WHERE (p_tem_custo IS NULL
         OR (p_tem_custo = 'com_custo' AND rf.tem_cmv = true)
         OR (p_tem_custo = 'sem_custo' AND rf.tem_cmv = false))
  ORDER BY rf.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
