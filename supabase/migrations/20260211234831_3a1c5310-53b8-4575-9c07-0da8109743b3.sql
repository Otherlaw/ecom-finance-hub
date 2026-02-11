
-- Atualizar a RPC get_vendas_por_pedido para buscar também por referencia_externa
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
        OR mt.referencia_externa ILIKE '%' || p_busca || '%'
        OR EXISTS (
          SELECT 1 FROM marketplace_transaction_items mti2
          WHERE mti2.transaction_id = mt.id
            AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti2.descricao_item ILIKE '%' || p_busca || '%')
        )
      ))
  ),
  -- Pre-calculate CMV per item via JOIN (not correlated subquery)
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
    JOIN pedidos_base pb ON pb.pedido_id = mt_inner.pedido_id
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
    JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
    LEFT JOIN item_cmv ic ON ic.transaction_id = mt.id
    LEFT JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.tipo_transacao = 'venda'
    GROUP BY mt.pedido_id, mt.empresa_id, e.nome_fantasia, mt.canal, mt.conta_nome
  ),
  -- Filter by cost if requested
  filtered AS (
    SELECT ia.*
    FROM itens_agregados ia
    WHERE (p_tem_custo IS NULL)
       OR (p_tem_custo = 'com_custo' AND ia.tem_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND (ia.tem_cmv = false OR ia.tem_cmv IS NULL))
  )
  SELECT
    f.pedido_id,
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

-- Também atualizar o count para buscar por referencia_externa
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
        OR mt.referencia_externa ILIKE '%' || p_busca || '%'
        OR EXISTS (
          SELECT 1 FROM marketplace_transaction_items mti2
          WHERE mti2.transaction_id = mt.id
            AND (mti2.sku_marketplace ILIKE '%' || p_busca || '%'
                 OR mti2.descricao_item ILIKE '%' || p_busca || '%')
        )
      ))
  )
  SELECT COUNT(*) INTO v_count FROM pedidos_base;

  -- If filtering by cost, we need to re-count after joining items
  IF p_tem_custo IS NOT NULL THEN
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
          OR mt.referencia_externa ILIKE '%' || p_busca || '%'
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
        mt.pedido_id,
        BOOL_AND(
          COALESCE(
            (SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT p.custo_medio FROM produto_marketplace_map pmm JOIN produtos p ON p.id = pmm.produto_id WHERE pmm.sku_marketplace = mti.sku_marketplace AND pmm.empresa_id = mt.empresa_id AND pmm.ativo = true AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = mt.empresa_id AND COALESCE(p.custo_medio,0) > 0 LIMIT 1),
            (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = mt.empresa_id LIMIT 1)
          ) IS NOT NULL
        ) AS tem_cmv
      FROM marketplace_transactions mt
      JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
      LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
      WHERE mt.tipo_transacao = 'venda'
      GROUP BY mt.pedido_id
    )
    SELECT COUNT(*) INTO v_count
    FROM item_has_cost
    WHERE (p_tem_custo = 'com_custo' AND tem_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND (tem_cmv = false OR tem_cmv IS NULL));
  END IF;

  RETURN v_count;
END;
$function$;
