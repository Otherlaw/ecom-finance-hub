-- Drop da função existente para poder alterar o retorno (adicionar nome_fantasia)
DROP FUNCTION IF EXISTS get_vendas_por_pedido(uuid,date,date,text,text,text,text,integer,integer);

-- Recriar RPC get_vendas_por_pedido com nome_fantasia da empresa
CREATE OR REPLACE FUNCTION get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT CURRENT_DATE - 7,
  p_data_fim DATE DEFAULT CURRENT_DATE,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_busca TEXT DEFAULT NULL,
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
  tem_cmv BOOLEAN
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
  -- Converter datas para timestamptz usando fuso BR
  v_ts_inicio := date_to_br_timestamptz(p_data_inicio);
  v_ts_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  -- Buscar alíquota de imposto da empresa (ou usar default 6%)
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
      ) AS cmv_total,
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
          ELSE false
        END
      ) AS tem_cmv
    FROM marketplace_transactions mt
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.pedido_id IN (SELECT pb.pedido_id FROM pedidos_base pb)
      AND mt.tipo_transacao = 'venda'
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
    ROUND(ia.valor_produto * (v_aliquota_imposto / 100), 2) AS impostos_total,
    ia.outros_descontos_total,
    ia.valor_produto - ia.comissao_total - ia.tarifa_fixa_total - ia.frete_vendedor_total - ia.ads_total - ia.outros_descontos_total AS valor_liquido_calculado,
    ia.qtd_itens::BIGINT,
    CASE WHEN ia.tem_cmv THEN ia.cmv_total ELSE NULL END AS cmv_total,
    CASE WHEN ia.tem_cmv THEN
      ia.valor_produto 
      - ia.comissao_total 
      - ia.tarifa_fixa_total 
      - ia.frete_vendedor_total 
      - ia.ads_total
      - ROUND(ia.valor_produto * (v_aliquota_imposto / 100), 2)
      - ia.cmv_total
    ELSE NULL END AS margem_contribuicao,
    ia.tem_cmv
  FROM itens_agregados ia
  ORDER BY ia.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;