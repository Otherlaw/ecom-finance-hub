
-- =============================================================================
-- RPC: get_vendas_por_pedido
-- Agrega marketplace_transactions por pedido_id, retornando 1 linha por pedido
-- Inclui todos os custos: comissão (taxas), tarifa (tarifas), frete vendedor, ads
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  pedido_id TEXT,
  empresa_id UUID,
  canal TEXT,
  conta_nome TEXT,
  data_pedido TIMESTAMPTZ,
  data_repasse DATE,
  status TEXT,
  tipo_envio TEXT,
  -- Valores
  valor_produto NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  outros_descontos_total NUMERIC,
  valor_liquido_calculado NUMERIC,
  -- CMV e margem
  qtd_itens INT,
  cmv_total NUMERIC,
  margem_contribuicao NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH pedidos_agregados AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      MIN(mt.data_transacao) AS data_pedido,
      MAX(mt.data_repasse) AS data_repasse,
      -- Status: prioriza 'conciliado' se existir, senão pega o mais recente
      COALESCE(
        MAX(CASE WHEN mt.status = 'conciliado' THEN 'conciliado' END),
        MAX(mt.status)
      ) AS status,
      MAX(mt.tipo_envio) AS tipo_envio,
      -- Valor do produto = soma dos créditos de venda
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto,
      -- Comissão = taxas (CV - sales commission)
      COALESCE(SUM(mt.taxas), 0) AS comissao_total,
      -- Tarifa fixa = tarifas (FINANCING_FEE, tarifa_fixa)
      COALESCE(SUM(mt.tarifas), 0) AS tarifa_fixa_total,
      -- Frete vendedor = CXE
      COALESCE(SUM(mt.frete_vendedor), 0) AS frete_vendedor_total,
      -- Ads
      COALESCE(SUM(mt.custo_ads), 0) AS ads_total,
      -- Impostos (estimado 6% do valor bruto de vendas por enquanto)
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto * 0.06 ELSE 0 END), 0) AS impostos_total,
      -- Outros descontos
      COALESCE(SUM(mt.outros_descontos), 0) AS outros_descontos_total
    FROM marketplace_transactions mt
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
    GROUP BY mt.pedido_id, mt.empresa_id, mt.canal, mt.conta_nome
  ),
  -- Calcular CMV por pedido (join com itens e produtos)
  cmv_por_pedido AS (
    SELECT
      mt.pedido_id,
      COUNT(DISTINCT mti.id)::INT AS qtd_itens,
      COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0) AS cmv_total
    FROM marketplace_transactions mt
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
    GROUP BY mt.pedido_id
  )
  SELECT
    pa.pedido_id,
    pa.empresa_id,
    pa.canal,
    pa.conta_nome,
    pa.data_pedido,
    pa.data_repasse,
    pa.status,
    pa.tipo_envio,
    pa.valor_produto,
    pa.comissao_total,
    pa.tarifa_fixa_total,
    pa.frete_vendedor_total,
    pa.ads_total,
    pa.impostos_total,
    pa.outros_descontos_total,
    -- Valor líquido = produto - comissão - tarifa - frete vendedor - ads - impostos - outros
    (pa.valor_produto - pa.comissao_total - pa.tarifa_fixa_total - pa.frete_vendedor_total - pa.ads_total - pa.impostos_total - pa.outros_descontos_total) AS valor_liquido_calculado,
    COALESCE(cp.qtd_itens, 0) AS qtd_itens,
    COALESCE(cp.cmv_total, 0) AS cmv_total,
    -- Margem de contribuição = líquido - CMV
    (pa.valor_produto - pa.comissao_total - pa.tarifa_fixa_total - pa.frete_vendedor_total - pa.ads_total - pa.impostos_total - pa.outros_descontos_total - COALESCE(cp.cmv_total, 0)) AS margem_contribuicao
  FROM pedidos_agregados pa
  LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pa.pedido_id
  ORDER BY pa.data_pedido DESC, pa.pedido_id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- RPC: get_vendas_por_pedido_count
-- Conta total de pedidos únicos para paginação
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(DISTINCT pedido_id) INTO total
  FROM marketplace_transactions mt
  WHERE 
    mt.pedido_id IS NOT NULL
    AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
    AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
    AND (p_canal IS NULL OR mt.canal = p_canal)
    AND (p_conta IS NULL OR mt.conta_nome = p_conta)
    AND (p_status IS NULL OR mt.status = p_status);
  
  RETURN total;
END;
$$;

-- =============================================================================
-- RPC: get_vendas_por_pedido_resumo
-- Resumo agregado de todos os pedidos no período
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos BIGINT,
  total_itens BIGINT,
  valor_produto_total NUMERIC,
  comissao_total NUMERIC,
  tarifa_fixa_total NUMERIC,
  frete_vendedor_total NUMERIC,
  ads_total NUMERIC,
  impostos_total NUMERIC,
  valor_liquido_total NUMERIC,
  cmv_total NUMERIC,
  margem_contribuicao_total NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH pedidos_agregados AS (
    SELECT
      mt.pedido_id,
      -- Valor do produto = soma dos créditos de venda
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto ELSE 0 END), 0) AS valor_produto,
      COALESCE(SUM(mt.taxas), 0) AS comissao,
      COALESCE(SUM(mt.tarifas), 0) AS tarifa_fixa,
      COALESCE(SUM(mt.frete_vendedor), 0) AS frete_vendedor,
      COALESCE(SUM(mt.custo_ads), 0) AS ads,
      COALESCE(SUM(CASE WHEN mt.tipo_lancamento = 'credito' AND mt.tipo_transacao = 'venda' THEN mt.valor_bruto * 0.06 ELSE 0 END), 0) AS impostos
    FROM marketplace_transactions mt
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
    GROUP BY mt.pedido_id
  ),
  cmv_por_pedido AS (
    SELECT
      mt.pedido_id,
      COUNT(DISTINCT mti.id) AS qtd_itens,
      COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0) AS cmv
    FROM marketplace_transactions mt
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE 
      mt.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_data_inicio IS NULL OR mt.data_transacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR mt.data_transacao < p_data_fim)
    GROUP BY mt.pedido_id
  )
  SELECT
    COUNT(DISTINCT pa.pedido_id)::BIGINT AS total_pedidos,
    COALESCE(SUM(COALESCE(cp.qtd_itens, 0)), 0)::BIGINT AS total_itens,
    COALESCE(SUM(pa.valor_produto), 0) AS valor_produto_total,
    COALESCE(SUM(pa.comissao), 0) AS comissao_total,
    COALESCE(SUM(pa.tarifa_fixa), 0) AS tarifa_fixa_total,
    COALESCE(SUM(pa.frete_vendedor), 0) AS frete_vendedor_total,
    COALESCE(SUM(pa.ads), 0) AS ads_total,
    COALESCE(SUM(pa.impostos), 0) AS impostos_total,
    COALESCE(SUM(pa.valor_produto - pa.comissao - pa.tarifa_fixa - pa.frete_vendedor - pa.ads - pa.impostos), 0) AS valor_liquido_total,
    COALESCE(SUM(COALESCE(cp.cmv, 0)), 0) AS cmv_total,
    COALESCE(SUM(pa.valor_produto - pa.comissao - pa.tarifa_fixa - pa.frete_vendedor - pa.ads - pa.impostos - COALESCE(cp.cmv, 0)), 0) AS margem_contribuicao_total
  FROM pedidos_agregados pa
  LEFT JOIN cmv_por_pedido cp ON cp.pedido_id = pa.pedido_id;
END;
$$;
