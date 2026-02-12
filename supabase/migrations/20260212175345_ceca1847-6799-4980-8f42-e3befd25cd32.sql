
-- 1) Add pack_id column to marketplace_transactions
ALTER TABLE public.marketplace_transactions
  ADD COLUMN IF NOT EXISTS pack_id text;

-- 2) Backfill pack_id from raw_order
UPDATE public.marketplace_transactions
SET pack_id = raw_order->>'pack_id'
WHERE raw_order IS NOT NULL
  AND raw_order->>'pack_id' IS NOT NULL
  AND pack_id IS NULL;

-- 3) Index for COALESCE(pack_id, pedido_id) grouping
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pack_group
  ON public.marketplace_transactions (( COALESCE(pack_id, pedido_id) ));

-- 4) Index for looking up transactions by pack_id
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pack_id
  ON public.marketplace_transactions (pack_id)
  WHERE pack_id IS NOT NULL;

-- 5) Update get_vendas_por_pedido to group by COALESCE(pack_id, pedido_id)
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamptz,
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
  tem_cmv boolean,
  primeiro_anuncio_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT DISTINCT COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id
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
        OR mt.referencia_externa ILIKE '%' || p_busca || '%'
        OR mt.pack_id ILIKE '%' || p_busca || '%'
        OR EXISTS (
          SELECT 1 FROM marketplace_transaction_items mti2
          WHERE mti2.transaction_id = mt.id
            AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti2.descricao_item ILIKE '%' || p_busca || '%')
        )
      ))
  ),
  item_cmv AS (
    SELECT
      mti.id AS item_id,
      mti.transaction_id,
      mti.quantidade,
      mti.preco_total,
      mti.preco_unitario,
      mti.produto_id,
      mti.sku_marketplace,
      mti.anuncio_id,
      mti.descricao_item,
      COALESCE(
        p_direct.custo_medio,
        p_mapped.custo_medio,
        p_sku.custo_medio,
        sc.custo_unitario,
        0
      ) AS custo_unit
    FROM marketplace_transactions mt_inner
    JOIN pedidos_base pb ON pb.pedido_group_id = COALESCE(mt_inner.pack_id, mt_inner.pedido_id)
    JOIN marketplace_transaction_items mti ON mti.transaction_id = mt_inner.id
    LEFT JOIN produtos p_direct ON p_direct.id = mti.produto_id
    LEFT JOIN LATERAL (
      SELECT p2.custo_medio
      FROM produto_marketplace_map pmm
      JOIN produtos p2 ON p2.id = pmm.produto_id
      WHERE pmm.sku_marketplace = mti.sku_marketplace
        AND pmm.empresa_id = mt_inner.empresa_id
        AND pmm.ativo = true
        AND mti.produto_id IS NULL
        AND mti.sku_marketplace IS NOT NULL
      LIMIT 1
    ) p_mapped ON true
    LEFT JOIN LATERAL (
      SELECT p3.custo_medio
      FROM produtos p3
      WHERE p3.sku = mti.sku_marketplace
        AND p3.empresa_id = mt_inner.empresa_id
        AND mti.produto_id IS NULL
        AND mti.sku_marketplace IS NOT NULL
        AND p_mapped.custo_medio IS NULL
      LIMIT 1
    ) p_sku ON true
    LEFT JOIN LATERAL (
      SELECT sc2.custo_unitario
      FROM sku_costs sc2
      WHERE sc2.sku = mti.sku_marketplace
        AND sc2.empresa_id = mt_inner.empresa_id
        AND mti.produto_id IS NULL
        AND mti.sku_marketplace IS NOT NULL
        AND p_mapped.custo_medio IS NULL
        AND p_sku.custo_medio IS NULL
      LIMIT 1
    ) sc ON true
    WHERE mt_inner.tipo_transacao = 'venda'
  ),
  itens_agregados AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id,
      mt.empresa_id,
      e.nome_fantasia AS empresa_nome_fantasia,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      MAX(mt.status) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      COALESCE(SUM(
        CASE WHEN ic.item_id IS NOT NULL
        THEN COALESCE(ic.preco_total, ic.preco_unitario * ic.quantidade, 0)
        ELSE mt.valor_bruto END
      ), 0)::numeric AS valor_produto,
      SUM(COALESCE(mt.taxas, 0))::numeric AS comissao_total,
      SUM(COALESCE(mt.tarifas, 0))::numeric AS tarifa_fixa_total,
      SUM(COALESCE(mt.frete_vendedor, 0))::numeric AS frete_vendedor_total,
      SUM(COALESCE(mt.custo_ads, 0))::numeric AS ads_total,
      ROUND(SUM(mt.valor_bruto) * v_aliquota_imposto / 100, 2)::numeric AS impostos_total,
      SUM(COALESCE(mt.outros_descontos, 0))::numeric AS outros_descontos_total,
      SUM(COALESCE(mt.valor_liquido, 0))::numeric AS valor_liquido_calculado,
      COALESCE(SUM(COALESCE(ic.quantidade, 0)), 0)::bigint AS qtd_itens,
      COALESCE(SUM(ic.quantidade * ic.custo_unit), 0)::numeric AS cmv_total,
      BOOL_AND(COALESCE(ic.custo_unit, 0) > 0) AS tem_cmv,
      MIN(ic.anuncio_id) AS primeiro_anuncio_id
    FROM marketplace_transactions mt
    JOIN pedidos_base pb ON pb.pedido_group_id = COALESCE(mt.pack_id, mt.pedido_id)
    LEFT JOIN item_cmv ic ON ic.transaction_id = mt.id
    LEFT JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.tipo_transacao = 'venda'
    GROUP BY COALESCE(mt.pack_id, mt.pedido_id), mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  ),
  filtered AS (
    SELECT ia.*
    FROM itens_agregados ia
    WHERE (p_tem_custo IS NULL)
       OR (p_tem_custo = 'com_custo' AND ia.tem_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND (ia.tem_cmv = false OR ia.tem_cmv IS NULL))
  )
  SELECT
    f.pedido_group_id AS pedido_id,
    f.empresa_id,
    f.empresa_nome_fantasia,
    f.canal,
    f.conta_nome,
    f.data_pedido,
    f.data_repasse::date,
    f.status,
    f.tipo_envio,
    f.valor_produto,
    f.comissao_total,
    f.tarifa_fixa_total,
    f.frete_vendedor_total,
    f.ads_total,
    f.impostos_total,
    f.outros_descontos_total,
    f.valor_liquido_calculado,
    f.qtd_itens,
    f.cmv_total,
    CASE WHEN f.tem_cmv THEN
      f.valor_produto - f.comissao_total - f.tarifa_fixa_total - f.frete_vendedor_total - f.ads_total - f.impostos_total - f.cmv_total
    ELSE NULL END AS margem_contribuicao,
    f.tem_cmv,
    f.primeiro_anuncio_id
  FROM filtered f
  ORDER BY f.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- 6) Update get_vendas_por_pedido_count
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ts_inicio TIMESTAMPTZ;
  v_ts_fim TIMESTAMPTZ;
  v_count bigint;
BEGIN
  v_ts_inicio := date_to_br_timestamptz(p_data_inicio);
  v_ts_fim := date_to_br_timestamptz(p_data_fim + 1);

  WITH pedidos_base AS (
    SELECT DISTINCT COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id
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
        OR mt.referencia_externa ILIKE '%' || p_busca || '%'
        OR mt.pack_id ILIKE '%' || p_busca || '%'
        OR EXISTS (
          SELECT 1 FROM marketplace_transaction_items mti2
          WHERE mti2.transaction_id = mt.id
            AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti2.descricao_item ILIKE '%' || p_busca || '%')
        )
      ))
  )
  SELECT COUNT(*) INTO v_count FROM pedidos_base;

  IF p_tem_custo IS NOT NULL THEN
    WITH pedidos_base AS (
      SELECT DISTINCT COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id
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
          OR mt.referencia_externa ILIKE '%' || p_busca || '%'
          OR mt.pack_id ILIKE '%' || p_busca || '%'
          OR EXISTS (
            SELECT 1 FROM marketplace_transaction_items mti2
            WHERE mti2.transaction_id = mt.id
              AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                   OR mti2.descricao_item ILIKE '%' || p_busca || '%')
          )
        ))
    ),
    item_has_cost AS (
      SELECT
        COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id,
        BOOL_AND(
          COALESCE(
            (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT p.custo_medio FROM produto_marketplace_map pmm JOIN produtos p ON p.id = pmm.produto_id WHERE pmm.sku_marketplace = mti.sku_marketplace AND pmm.empresa_id = mt.empresa_id AND pmm.ativo = true AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = mt.empresa_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = mt.empresa_id LIMIT 1)
          ) IS NOT NULL
        ) AS tem_cmv
      FROM marketplace_transactions mt
      JOIN pedidos_base pb ON pb.pedido_group_id = COALESCE(mt.pack_id, mt.pedido_id)
      LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
      WHERE mt.tipo_transacao = 'venda'
      GROUP BY COALESCE(mt.pack_id, mt.pedido_id)
    )
    SELECT COUNT(*) INTO v_count
    FROM item_has_cost
    WHERE (p_tem_custo = 'com_custo' AND tem_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND (tem_cmv = false OR tem_cmv IS NULL));
  END IF;

  RETURN v_count;
END;
$function$;

-- 7) Update get_vendas_por_pedido_resumo
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
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
    SELECT DISTINCT ON (COALESCE(mt.pack_id, mt.pedido_id))
      COALESCE(mt.pack_id, mt.pedido_id) AS pedido_group_id,
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
    ORDER BY COALESCE(mt.pack_id, mt.pedido_id), mt.data_transacao DESC
  ),
  itens_por_pedido AS (
    SELECT 
      pb.pedido_group_id,
      COALESCE(SUM(COALESCE(mti.quantidade, 1)), 0) as qtd_itens,
      COALESCE(SUM(
        COALESCE(mti.quantidade, 1) * COALESCE(
          (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
          (SELECT p.custo_medio FROM produto_marketplace_map pmm 
           JOIN produtos p ON p.id = pmm.produto_id 
           WHERE pmm.sku_marketplace = mti.sku_marketplace 
             AND pmm.empresa_id = pb.empresa_id 
             AND pmm.ativo = true 
             AND COALESCE(p.custo_medio, 0) > 0 
           LIMIT 1),
          (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pb.empresa_id AND COALESCE(p.custo_medio, 0) > 0 LIMIT 1),
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
    GROUP BY pb.pedido_group_id
  ),
  raw_cmv AS (
    SELECT
      pb.pedido_group_id,
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
    GROUP BY pb.pedido_group_id
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_group_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_vend,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as ads
    FROM (
      SELECT 
        COALESCE(mt2.pack_id, mfe.pedido_id) AS pedido_group_id,
        mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (PARTITION BY COALESCE(mt2.pack_id, mfe.pedido_id), mfe.tipo_evento ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END) as rn
      FROM marketplace_financial_events mfe
      LEFT JOIN marketplace_transactions mt2 ON mt2.pedido_id = mfe.pedido_id AND mt2.tipo_transacao = 'venda'
      WHERE mfe.pedido_id IN (SELECT mt3.pedido_id FROM marketplace_transactions mt3 WHERE COALESCE(mt3.pack_id, mt3.pedido_id) IN (SELECT pb2.pedido_group_id FROM pedidos_base pb2))
    ) fe
    GROUP BY fe.pedido_group_id
  ),
  config_fiscal AS (
    SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
    FROM empresas_config_fiscal ecf
  ),
  pedidos_calc AS (
    SELECT
      pb.pedido_group_id,
      pb.empresa_id,
      pb.valor_bruto,
      pb.valor_liquido,
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN ip.qtd_itens 
        WHEN rc.qtd_raw IS NOT NULL THEN rc.qtd_raw
        ELSE 1 
      END as qtd_itens,
      COALESCE(NULLIF(epp.comissao, 0), pb.taxas) as comissao,
      COALESCE(NULLIF(epp.tarifa_fixa, 0), pb.tarifas) as tarifa_fixa,
      COALESCE(NULLIF(epp.frete_vend, 0), pb.frete_vendedor) as frete_vend,
      COALESCE(NULLIF(epp.ads, 0), pb.custo_ads) as ads,
      ROUND((pb.valor_bruto * COALESCE(cf.aliquota_imposto_vendas, 6) / 100), 2) as impostos,
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN ip.cmv_itens
        WHEN rc.cmv_raw IS NOT NULL THEN rc.cmv_raw
        ELSE 0
      END as cmv_calc,
      CASE 
        WHEN COALESCE(ip.item_count, 0) > 0 THEN COALESCE(ip.tem_cmv, false)
        WHEN COALESCE(rc.cmv_raw, 0) > 0 THEN true
        ELSE false
      END as tem_cmv
    FROM pedidos_base pb
    LEFT JOIN itens_por_pedido ip ON ip.pedido_group_id = pb.pedido_group_id
    LEFT JOIN raw_cmv rc ON rc.pedido_group_id = pb.pedido_group_id
    LEFT JOIN eventos_por_pedido epp ON epp.pedido_group_id = pb.pedido_group_id
    LEFT JOIN config_fiscal cf ON cf.empresa_id = pb.empresa_id
  )
  SELECT
    COUNT(DISTINCT pc.pedido_group_id)::bigint as total_pedidos,
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
$function$;
