
-- Atualiza get_vendas_por_pedido_resumo para usar a mesma lógica de CMV com fallback via raw_order
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos bigint,
  total_itens numeric,
  valor_produto_total numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  valor_liquido_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv bigint,
  pedidos_sem_cmv bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN;
    END IF;
  END IF;
  
  IF array_length(v_user_empresa_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.raw_order
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  -- CMV de itens físicos (marketplace_transaction_items)
  itens_por_pedido AS (
    SELECT 
      pb.pedido_id,
      COALESCE(SUM(COALESCE(mti.quantidade, 1)), 0) as qtd_itens,
      COALESCE(SUM(
        COALESCE(mti.quantidade, 1) * COALESCE(
          -- 1) produto_id direto
          (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          -- 2) mapeamento produto_marketplace_map
          (SELECT p.custo_medio FROM produto_marketplace_map pmm 
           JOIN produtos p ON p.id = pmm.produto_id 
           WHERE pmm.sku_marketplace = mti.sku_marketplace 
             AND pmm.empresa_id = pb.empresa_id 
             AND pmm.ativo = true 
             AND COALESCE(p.custo_medio, 0) > 0 
           LIMIT 1),
          -- 3) SKU direto na tabela produtos
          (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pb.empresa_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          -- 4) sku_costs
          (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pb.empresa_id LIMIT 1),
          0
        )
      ), 0) as cmv_itens,
      COUNT(mti.id) as item_count,
      BOOL_AND(
        COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produto_marketplace_map pmm JOIN produtos p ON p.id = pmm.produto_id WHERE pmm.sku_marketplace = mti.sku_marketplace AND pmm.empresa_id = pb.empresa_id AND pmm.ativo = true AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pb.empresa_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pb.empresa_id LIMIT 1)
        ) IS NOT NULL
      ) as tem_cmv
    FROM pedidos_base pb
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = pb.transaction_id
    GROUP BY pb.pedido_id
  ),
  -- CMV via raw_order para pedidos SEM itens físicos
  raw_cmv AS (
    SELECT
      pb.pedido_id,
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
             AND pmm.empresa_id = pb.empresa_id 
             AND pmm.ativo = true 
           LIMIT 1),
          0
        ) * COALESCE((oi->>'quantity')::int, 1)
      )::numeric AS cmv_raw,
      SUM(COALESCE((oi->>'quantity')::int, 1))::numeric AS qtd_raw
    FROM pedidos_base pb
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN pb.raw_order->'order_items' IS NOT NULL THEN pb.raw_order->'order_items'
        WHEN pb.raw_order->'items' IS NOT NULL THEN pb.raw_order->'items'
        ELSE '[]'::jsonb
      END
    ) AS oi
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_transaction_items mti WHERE mti.transaction_id = pb.transaction_id
    )
    GROUP BY pb.pedido_id
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_vend,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as ads
    FROM (
      SELECT 
        mfe.pedido_id, mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (PARTITION BY mfe.pedido_id, mfe.tipo_evento ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END) as rn
      FROM marketplace_financial_events mfe
      WHERE mfe.pedido_id IN (SELECT pb2.pedido_id FROM pedidos_base pb2)
    ) fe
    GROUP BY fe.pedido_id
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
  ),
  pedidos_calc AS (
    SELECT
      pb.pedido_id,
      pb.empresa_id,
      pb.valor_bruto,
      pb.valor_liquido,
      -- Quantidade: prioriza itens físicos, depois raw_order
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN ip.qtd_itens 
        WHEN rc.qtd_raw IS NOT NULL THEN rc.qtd_raw
        ELSE 1 
      END as qtd_itens,
      -- Comissão: prioriza eventos, depois taxas
      COALESCE(NULLIF(epp.comissao, 0), pb.taxas) as comissao,
      COALESCE(NULLIF(epp.tarifa_fixa, 0), pb.tarifas) as tarifa_fixa,
      COALESCE(NULLIF(epp.frete_vend, 0), pb.frete_vendedor) as frete_vend,
      COALESCE(NULLIF(epp.ads, 0), pb.custo_ads) as ads,
      ROUND((pb.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2) as impostos,
      -- CMV: prioriza itens físicos, depois raw_order
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN ip.cmv_itens
        WHEN rc.cmv_raw IS NOT NULL THEN rc.cmv_raw
        ELSE 0
      END as cmv_calc,
      -- tem_cmv: considera ambas as fontes
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN COALESCE(ip.tem_cmv, false)
        WHEN COALESCE(rc.cmv_raw, 0) > 0 THEN true
        ELSE false
      END as tem_cmv
    FROM pedidos_base pb
    LEFT JOIN itens_por_pedido ip ON ip.pedido_id = pb.pedido_id
    LEFT JOIN raw_cmv rc ON rc.pedido_id = pb.pedido_id
    LEFT JOIN eventos_por_pedido epp ON epp.pedido_id = pb.pedido_id
    LEFT JOIN config_fiscal cf ON cf.empresa_id = pb.empresa_id
  )
  SELECT
    COUNT(DISTINCT pc.pedido_id)::bigint as total_pedidos,
    COALESCE(SUM(pc.qtd_itens), 0)::numeric as total_itens,
    COALESCE(SUM(pc.valor_bruto), 0)::numeric as valor_produto_total,
    COALESCE(SUM(pc.comissao), 0)::numeric as comissao_total,
    COALESCE(SUM(pc.tarifa_fixa), 0)::numeric as tarifa_fixa_total,
    COALESCE(SUM(pc.frete_vend), 0)::numeric as frete_vendedor_total,
    COALESCE(SUM(pc.ads), 0)::numeric as ads_total,
    COALESCE(SUM(pc.impostos), 0)::numeric as impostos_total,
    COALESCE(SUM(pc.valor_liquido), 0)::numeric as valor_liquido_total,
    COALESCE(SUM(pc.cmv_calc), 0)::numeric as cmv_total,
    COALESCE(SUM(
      CASE WHEN pc.cmv_calc > 0 THEN
        pc.valor_bruto 
        - pc.comissao 
        - pc.tarifa_fixa 
        - pc.frete_vend 
        - pc.ads 
        - pc.impostos 
        - pc.cmv_calc
      ELSE 0 END
    ), 0)::numeric as margem_contribuicao_total,
    COUNT(CASE WHEN pc.tem_cmv THEN 1 END)::bigint as pedidos_com_cmv,
    COUNT(CASE WHEN NOT pc.tem_cmv THEN 1 END)::bigint as pedidos_sem_cmv
  FROM pedidos_calc pc;
END;
$$;
