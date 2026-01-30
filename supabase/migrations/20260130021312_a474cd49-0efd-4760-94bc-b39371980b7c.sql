
-- =====================================================================
-- Migração: Corrigir CMV com fallback por SKU + sku_costs
-- Afeta: get_dashboard_kpis_period e get_top_produtos_vendidos
-- =====================================================================

-- Primeiro, remover as funções existentes para poder recriá-las
DROP FUNCTION IF EXISTS public.get_dashboard_kpis_period(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_top_produtos_vendidos(uuid, date, date, integer);

-- ========================
-- PARTE A: get_dashboard_kpis_period
-- Adiciona fallback por SKU e sku_costs no cálculo do CMV
-- ========================

CREATE FUNCTION public.get_dashboard_kpis_period(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  WITH 
  vendas_transacoes AS (
    SELECT
      mt.canal,
      mt.pedido_id,
      mt.tipo_lancamento,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE 
      (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  -- Eventos com prioridade para 'report'
  eventos_financeiros AS (
    SELECT
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor,
      fe.origem,
      ROW_NUMBER() OVER (
        PARTITION BY fe.pedido_id, fe.tipo_evento 
        ORDER BY CASE WHEN fe.origem = 'report' THEN 1 ELSE 2 END
      ) AS rn
    FROM marketplace_financial_events fe
    WHERE 
      (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
  ),
  eventos_priorizados AS (
    SELECT pedido_id, tipo_evento, valor, origem
    FROM eventos_financeiros
    WHERE rn = 1
  ),
  
  -- CMV com fallback: produto_id -> sku_marketplace -> sku_costs
  cmv_periodo AS (
    SELECT
      COALESCE(SUM(
        mti.quantidade * COALESCE(
          NULLIF(p_by_id.custo_medio, 0),
          NULLIF(p_by_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0),
          0
        )
      ), 0) AS cmv_total,
      COUNT(DISTINCT CASE 
        WHEN COALESCE(NULLIF(p_by_id.custo_medio, 0), NULLIF(p_by_sku.custo_medio, 0), NULLIF(sc.custo_unitario, 0)) > 0 
        THEN mti.id 
      END) AS itens_com_custo,
      COUNT(DISTINCT mti.id) AS total_itens
    FROM marketplace_transactions mt
    INNER JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    -- Join primário: por produto_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    -- Join fallback 1: por sku_marketplace + empresa_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
    -- Join fallback 2: tabela sku_costs
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = mt.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
      AND COALESCE(p_by_sku.custo_medio, 0) = 0
    WHERE 
      mt.tipo_lancamento = 'credito'
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  despesas_banco AS (
    SELECT
      COALESCE(SUM(ABS(bt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM bank_transactions bt
    WHERE 
      bt.tipo_lancamento IN ('saida', 'debito')
      AND bt.status != 'cancelado'
      AND (v_inicio IS NULL OR bt.data_transacao::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR bt.data_transacao::TIMESTAMPTZ < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR bt.empresa_id = p_empresa_id)
  ),
  
  despesas_manuais AS (
    SELECT
      COALESCE(SUM(ABS(mt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM manual_transactions mt
    WHERE 
      mt.tipo IN ('saida', 'despesa')
      AND mt.status = 'aprovado'
      AND (v_inicio IS NULL OR mt.data::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data::TIMESTAMPTZ < v_fim_exclusivo)
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  
  metricas_vendas AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS faturamento_bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(taxas, 0)), 0) AS comissao_total_legado,
      COALESCE(SUM(COALESCE(tarifas, 0)), 0) AS tarifa_fixa_total_legado,
      COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0) AS frete_vendedor_total,
      COALESCE(SUM(COALESCE(frete_comprador, 0)), 0) AS frete_comprador_total,
      COALESCE(SUM(COALESCE(custo_ads, 0)), 0) AS ads_total,
      COUNT(DISTINCT pedido_id) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM vendas_transacoes
  ),
  
  metricas_eventos AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_evento = 'comissao' THEN ABS(valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'frete_vendedor' THEN ABS(valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'ads' THEN ABS(valor) ELSE 0 END), 0) AS ads_eventos,
      COUNT(*) AS total_eventos,
      COUNT(*) FILTER (WHERE origem = 'report') AS eventos_report
    FROM eventos_priorizados
  ),
  
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS liquido,
      COUNT(DISTINCT pedido_id) AS pedidos
    FROM vendas_transacoes
    GROUP BY canal
  )
  
  SELECT jsonb_build_object(
    'faturamento_bruto', mv.faturamento_bruto,
    'receita_liquida', mv.receita_liquida,
    'pedidos_unicos', mv.pedidos_unicos,
    'total_transacoes', mv.total_transacoes,
    'comissao_total', CASE WHEN me.total_eventos > 0 THEN me.comissao_eventos ELSE mv.comissao_total_legado END,
    'tarifa_fixa_total', CASE WHEN me.total_eventos > 0 THEN me.tarifa_eventos ELSE mv.tarifa_fixa_total_legado END,
    'frete_vendedor_total', CASE WHEN me.total_eventos > 0 THEN me.frete_vendedor_eventos ELSE mv.frete_vendedor_total END,
    'ads_total', CASE WHEN me.total_eventos > 0 THEN me.ads_eventos ELSE mv.ads_total END,
    'impostos_total', ROUND(mv.faturamento_bruto * 0.06, 2),
    'impostos_estimado', TRUE,
    'cmv_total', cmv.cmv_total,
    'cmv_itens_com_custo', cmv.itens_com_custo,
    'cmv_total_itens', cmv.total_itens,
    'cmv_completo', cmv.itens_com_custo = cmv.total_itens AND cmv.total_itens > 0,
    'despesas_operacionais_total', db.total_despesas + dm.total_despesas,
    'despesas_banco', db.total_despesas,
    'despesas_manuais', dm.total_despesas,
    'qtd_despesas', db.qtd_despesas + dm.qtd_despesas,
    'lucro_bruto', mv.receita_liquida - cmv.cmv_total,
    'lucro_liquido', mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas),
    'margem_bruta_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'margem_liquida_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas)) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'ticket_medio', CASE WHEN mv.pedidos_unicos > 0 
      THEN ROUND(mv.faturamento_bruto / mv.pedidos_unicos, 2) 
      ELSE 0 END,
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb),
    'tem_eventos_financeiros', me.total_eventos > 0,
    'eventos_de_relatorio', me.eventos_report
  ) INTO v_result
  FROM metricas_vendas mv
  CROSS JOIN metricas_eventos me
  CROSS JOIN cmv_periodo cmv
  CROSS JOIN despesas_banco db
  CROSS JOIN despesas_manuais dm;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ========================
-- PARTE B: get_top_produtos_vendidos
-- Melhora fallback de custo: mesmo quando produto_id existe mas custo = 0
-- ========================

CREATE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(
  produto_id text,
  produto_nome text,
  produto_sku text,
  produto_imagem_url text,
  custo_unitario numeric,
  qtd_total numeric,
  total_faturado numeric,
  total_ads numeric,
  por_canal jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
BEGIN
  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas_items AS (
    SELECT
      -- Chave do produto: prioriza produto_id, senão usa SKU
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      -- Nome: prioriza produto vinculado por ID, depois por SKU, depois descrição
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      -- SKU: prioriza produto vinculado por ID, depois por SKU
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      -- Imagem: tenta ambos os joins
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      -- CUSTO: Fallback robusto - produto_id -> sku produto -> sku_costs
      COALESCE(
        NULLIF(p_by_id.custo_medio, 0), 
        NULLIF(p_by_sku.custo_medio, 0), 
        NULLIF(sc.custo_unitario, 0),
        0
      ) as custo,
      COALESCE(mti.quantidade, 0) as quantidade,
      COALESCE(mti.preco_total, 0) as preco_total,
      mt.canal,
      mt.id as transaction_id,
      COALESCE(mt.custo_ads, 0) as custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    -- JOIN primário: por produto_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    -- JOIN fallback 1: por SKU (sempre tenta, não só quando produto_id é NULL)
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND p_by_sku.id IS DISTINCT FROM mti.produto_id
    -- JOIN fallback 2: tabela sku_costs
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = mt.empresa_id
    WHERE 
      (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  ),
  -- Agrupar por produto (prod_key)
  agregado AS (
    SELECT
      vi.prod_key,
      vi.nome,
      vi.sku,
      vi.imagem_url,
      MAX(vi.custo) as custo_unitario,
      SUM(vi.quantidade) as qtd_total,
      SUM(vi.preco_total) as total_faturado,
      SUM(vi.custo_ads) as total_ads,
      -- Agregar quantidades por canal corretamente
      jsonb_object_agg(
        vi.canal, 
        vi.quantidade
      ) FILTER (WHERE vi.canal IS NOT NULL) as por_canal_raw
    FROM vendas_items vi
    GROUP BY vi.prod_key, vi.nome, vi.sku, vi.imagem_url
  )
  SELECT
    a.prod_key as produto_id,
    a.nome as produto_nome,
    a.sku as produto_sku,
    a.imagem_url as produto_imagem_url,
    a.custo_unitario,
    a.qtd_total,
    a.total_faturado,
    a.total_ads,
    COALESCE(a.por_canal_raw, '{}'::jsonb) as por_canal
  FROM agregado a
  ORDER BY a.total_faturado DESC
  LIMIT p_limite;
END;
$$;

-- Comentário para rastreabilidade
COMMENT ON FUNCTION public.get_dashboard_kpis_period IS 'KPIs do Dashboard com CMV fallback: produto_id -> sku produto -> sku_costs';
COMMENT ON FUNCTION public.get_top_produtos_vendidos IS 'Top produtos vendidos com CMV fallback robusto e suporte consolidado';
