-- Simplificar a RPC: calcular CMV via raw_order em etapa separada

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - 7,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamp with time zone,
  data_repasse date,
  status text,
  tipo_envio text,
  valor_produto numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  outros_descontos_total numeric,
  valor_liquido_calculado numeric,
  qtd_itens bigint,
  cmv_total numeric,
  margem_contribuicao numeric,
  tem_cmv boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ts_inicio TIMESTAMPTZ;
  v_ts_fim TIMESTAMPTZ;
  v_aliquota_imposto NUMERIC;
BEGIN
  v_ts_inicio := date_to_br_timestamptz(p_data_inicio);
  v_ts_fim := date_to_br_timestamptz(p_data_fim + 1);
  
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
  -- PRÉ-CALCULAR CMV via raw_order para transações SEM itens físicos
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
      ) AS cmv_raw
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
      ), 0) AS valor_produto,
      SUM(COALESCE(mt.taxas, 0)) AS comissao_total,
      SUM(COALESCE(mt.tarifas, 0)) AS tarifa_fixa_total,
      SUM(COALESCE(mt.frete_vendedor, 0)) AS frete_vendedor_total,
      SUM(COALESCE(mt.custo_ads, 0)) AS ads_total,
      SUM(COALESCE(mt.outros_descontos, 0)) AS outros_descontos_total,
      COALESCE(SUM(mti.quantidade), 1) AS qtd_itens,
      -- CMV: itens físicos OU fallback para raw_cmv
      CASE
        WHEN COUNT(mti.id) > 0 THEN
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
          )
        ELSE
          -- Fallback: usar CMV pré-calculado do raw_order
          COALESCE((SELECT rc.cmv_raw FROM raw_cmv rc WHERE rc.p_id = mt.pedido_id AND rc.e_id = mt.empresa_id), 0)
      END AS cmv_total,
      -- tem_cmv
      CASE
        WHEN COUNT(mti.id) > 0 THEN
          BOOL_OR(
            CASE
              WHEN mti.produto_id IS NOT NULL THEN
                EXISTS (SELECT 1 FROM produtos p WHERE p.id = mti.produto_id AND p.custo_medio > 0)
              WHEN mti.sku_marketplace IS NOT NULL THEN
                EXISTS (
                  SELECT 1 FROM produto_marketplace_map pmm 
                  JOIN produtos p ON p.id = pmm.produto_id 
                  WHERE pmm.sku_marketplace = mti.sku_marketplace 
                    AND pmm.empresa_id = mt.empresa_id 
                    AND pmm.ativo = true 
                    AND p.custo_medio > 0
                )
                OR EXISTS (SELECT 1 FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = mt.empresa_id AND p.custo_medio > 0)
                OR EXISTS (SELECT 1 FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = mt.empresa_id AND sc.custo_unitario > 0)
              ELSE FALSE
            END
          )
        ELSE
          EXISTS (SELECT 1 FROM raw_cmv rc WHERE rc.p_id = mt.pedido_id AND rc.e_id = mt.empresa_id AND rc.cmv_raw > 0)
      END AS tem_cmv
    FROM marketplace_transactions mt
    JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
    JOIN empresas e ON e.id = mt.empresa_id
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    WHERE mt.tipo_transacao = 'venda'
    GROUP BY mt.pedido_id, mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  )
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
    ROUND(ia.valor_produto * v_aliquota_imposto / 100, 2) AS impostos_total,
    ia.outros_descontos_total,
    ROUND(
      ia.valor_produto 
      - ia.comissao_total 
      - ia.tarifa_fixa_total 
      - ia.frete_vendedor_total 
      - ia.ads_total 
      - ia.outros_descontos_total 
      - (ia.valor_produto * v_aliquota_imposto / 100),
      2
    ) AS valor_liquido_calculado,
    ia.qtd_itens,
    COALESCE(ia.cmv_total, 0) AS cmv_total,
    ROUND(
      ia.valor_produto 
      - ia.comissao_total 
      - ia.tarifa_fixa_total 
      - ia.frete_vendedor_total 
      - ia.ads_total 
      - ia.outros_descontos_total 
      - (ia.valor_produto * v_aliquota_imposto / 100)
      - COALESCE(ia.cmv_total, 0),
      2
    ) AS margem_contribuicao,
    ia.tem_cmv
  FROM itens_agregados ia
  ORDER BY ia.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;