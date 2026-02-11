
-- Drop the old function
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, text, text, text, integer, integer);

-- Add index for tipo_transacao + data_transacao (critical for pedidos_base CTE)
CREATE INDEX IF NOT EXISTS idx_mkt_tx_tipo_data_empresa
ON marketplace_transactions (tipo_transacao, data_transacao DESC, empresa_id)
WHERE tipo_transacao = 'venda';

-- Recreate with optimized CMV calculation
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_busca TEXT DEFAULT NULL,
  p_tipo_envio TEXT DEFAULT NULL,
  p_tem_custo TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
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
      SUM(COALESCE(mt.outros_descontos, 0))::numeric AS outros_descontos_total,
      COALESCE(SUM(ic.quantidade), 1)::bigint AS qtd_itens,
      COUNT(ic.item_id)::bigint AS item_count,
      SUM(COALESCE(ic.custo_unit * ic.quantidade, 0))::numeric AS cmv_itens,
      MIN(ic.anuncio_id) AS primeiro_anuncio_id_itens
    FROM marketplace_transactions mt
    JOIN pedidos_base pb ON pb.pedido_id = mt.pedido_id
    LEFT JOIN item_cmv ic ON ic.transaction_id = mt.id
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
        ELSE NULL
      END AS cmv_total,
      CASE
        WHEN ia.item_count > 0 THEN ia.cmv_itens > 0
        ELSE false
      END AS tem_cmv,
      ia.primeiro_anuncio_id_itens
    FROM itens_agregados ia
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

-- Also optimize count function
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_busca TEXT DEFAULT NULL,
  p_tipo_envio TEXT DEFAULT NULL,
  p_tem_custo TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts_inicio TIMESTAMPTZ;
  v_ts_fim TIMESTAMPTZ;
  v_count BIGINT;
BEGIN
  v_ts_inicio := date_to_br_timestamptz(p_data_inicio);
  v_ts_fim := date_to_br_timestamptz(p_data_fim + 1);

  IF p_tem_custo IS NOT NULL THEN
    WITH pedidos_base AS (
      SELECT DISTINCT mt.pedido_id, mt.empresa_id
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
    pedidos_com_cmv AS (
      SELECT pb.pedido_id,
        COALESCE(
          (SELECT SUM(
            CASE
              WHEN mti.produto_id IS NOT NULL THEN
                COALESCE((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0) * mti.quantidade
              WHEN mti.sku_marketplace IS NOT NULL THEN
                COALESCE(
                  (SELECT p.custo_medio FROM produto_marketplace_map pmm JOIN produtos p ON p.id = pmm.produto_id WHERE pmm.sku_marketplace = mti.sku_marketplace AND pmm.empresa_id = pb.empresa_id AND pmm.ativo = true LIMIT 1),
                  (SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pb.empresa_id LIMIT 1),
                  0
                ) * mti.quantidade
              ELSE 0
            END
          )
          FROM marketplace_transactions mt2
          JOIN marketplace_transaction_items mti ON mti.transaction_id = mt2.id
          WHERE mt2.pedido_id = pb.pedido_id AND mt2.empresa_id = pb.empresa_id),
          0
        ) > 0 AS tem_cmv
      FROM pedidos_base pb
    )
    SELECT COUNT(*)::BIGINT INTO v_count
    FROM pedidos_com_cmv
    WHERE (p_tem_custo = 'com_custo' AND tem_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND tem_cmv = false);
  ELSE
    SELECT COUNT(DISTINCT mt.pedido_id)::BIGINT INTO v_count
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
      ));
  END IF;

  RETURN v_count;
END;
$$;
