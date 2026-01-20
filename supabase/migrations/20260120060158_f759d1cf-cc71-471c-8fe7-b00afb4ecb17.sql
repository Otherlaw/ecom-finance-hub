-- Criar tabela sku_costs para custos diretos por SKU (sem precisar de produto cadastrado)
CREATE TABLE IF NOT EXISTS public.sku_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'Mercado Livre',
  custo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  descricao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_sku_costs_empresa_sku_canal UNIQUE (empresa_id, sku, canal)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_sku_costs_empresa_sku ON public.sku_costs(empresa_id, sku);

-- RLS
ALTER TABLE public.sku_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa pode ver próprios custos de SKU"
  ON public.sku_costs FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
  ));

CREATE POLICY "Empresa pode criar custos de SKU"
  ON public.sku_costs FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
  ));

CREATE POLICY "Empresa pode atualizar custos de SKU"
  ON public.sku_costs FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
  ));

CREATE POLICY "Empresa pode deletar custos de SKU"
  ON public.sku_costs FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
  ));

-- Trigger para atualizar atualizado_em
CREATE TRIGGER update_sku_costs_updated_at
  BEFORE UPDATE ON public.sku_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================
-- Atualizar a RPC get_vendas_por_pedido para usar sku_costs como fallback
-- ===========================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TEXT DEFAULT NULL,
  p_data_fim TEXT DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  pedido_id TEXT,
  empresa_id UUID,
  canal TEXT,
  conta_nome TEXT,
  data_pedido TIMESTAMPTZ,
  data_repasse TIMESTAMPTZ,
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
  v_data_inicio TIMESTAMPTZ;
  v_data_fim TIMESTAMPTZ;
BEGIN
  -- Converter datas BR para UTC
  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := public.date_to_br_timestamptz(p_data_inicio);
  ELSE
    v_data_inicio := NOW() - INTERVAL '30 days';
  END IF;
  
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := public.date_to_br_timestamptz(p_data_fim) + INTERVAL '1 day' - INTERVAL '1 second';
  ELSE
    v_data_fim := NOW();
  END IF;

  RETURN QUERY
  WITH transacoes_vendas AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      mt.data_transacao AS data_pedido,
      NULL::TIMESTAMPTZ AS data_repasse,
      mt.status,
      mt.tipo_envio,
      mt.valor_bruto AS valor_produto
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
  ),
  -- Buscar eventos financeiros com prioridade: report > api_conciliacoes > estimado_listing_prices > sale_fee > api_orders
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      -- Comissão: prioriza 'report', depois 'api_conciliacoes', depois outros
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.origem NOT IN ('report', 'api_conciliacoes') THEN ABS(fe.valor) END),
        0
      ) AS comissao_eventos,
      -- Tarifa fixa: prioriza 'report', depois 'api_conciliacoes', depois 'estimado_listing_prices'
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_fixa' AND fe.origem = 'estimado_listing_prices' THEN ABS(fe.valor) END),
        0
      ) AS tarifa_fixa_eventos,
      -- Tarifa financeira
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem = 'api_conciliacoes' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'tarifa_financeira' AND fe.origem NOT IN ('report', 'api_conciliacoes') THEN ABS(fe.valor) END),
        0
      ) AS tarifa_financeira_eventos,
      -- Frete vendedor
      COALESCE(
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.origem = 'report' THEN ABS(fe.valor) END),
        SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) END),
        0
      ) AS frete_vendedor_eventos,
      -- ADS
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) END), 0) AS ads_eventos
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
    GROUP BY fe.pedido_id
  ),
  -- Buscar itens e calcular CMV usando produto OU sku_costs como fallback
  itens_por_pedido AS (
    SELECT
      mt.pedido_id,
      SUM(mti.quantidade) AS qtd_itens,
      -- CMV: usa custo do produto OU custo do sku_costs
      SUM(
        CASE 
          WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0 THEN mti.quantidade * p.custo_medio
          WHEN sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0 THEN mti.quantidade * sc.custo_unitario
          ELSE NULL
        END
      ) AS cmv_calculado,
      -- Flag: todos os itens têm custo (via produto OU sku_costs)?
      BOOL_AND(
        (p.custo_medio IS NOT NULL AND p.custo_medio > 0) OR 
        (sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
      ) AS todos_tem_custo
    FROM marketplace_transactions mt
    JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    LEFT JOIN sku_costs sc ON sc.empresa_id = mt.empresa_id 
      AND sc.sku = mti.sku_marketplace 
      AND sc.canal = mt.canal
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    GROUP BY mt.pedido_id
  ),
  -- Buscar configuração fiscal da empresa para impostos
  config_fiscal AS (
    SELECT cf.empresa_id, cf.aliquota_imposto_vendas
    FROM empresas_config_fiscal cf
    WHERE p_empresa_id IS NULL OR cf.empresa_id = p_empresa_id
  )
  SELECT
    tv.pedido_id,
    tv.empresa_id,
    tv.canal,
    tv.conta_nome,
    tv.data_pedido,
    tv.data_repasse,
    tv.status,
    tv.tipo_envio,
    COALESCE(tv.valor_produto, 0)::NUMERIC AS valor_produto,
    COALESCE(ep.comissao_eventos, 0)::NUMERIC AS comissao_total,
    COALESCE(ep.tarifa_fixa_eventos + ep.tarifa_financeira_eventos, 0)::NUMERIC AS tarifa_fixa_total,
    COALESCE(ep.frete_vendedor_eventos, 0)::NUMERIC AS frete_vendedor_total,
    COALESCE(ep.ads_eventos, 0)::NUMERIC AS ads_total,
    ROUND(COALESCE(tv.valor_produto, 0) * COALESCE(cf.aliquota_imposto_vendas, 0) / 100, 2)::NUMERIC AS impostos_total,
    0::NUMERIC AS outros_descontos_total,
    ROUND(
      COALESCE(tv.valor_produto, 0) 
      - COALESCE(ep.comissao_eventos, 0)
      - COALESCE(ep.tarifa_fixa_eventos, 0) 
      - COALESCE(ep.tarifa_financeira_eventos, 0)
      - COALESCE(ep.frete_vendedor_eventos, 0)
      - COALESCE(ep.ads_eventos, 0)
      - ROUND(COALESCE(tv.valor_produto, 0) * COALESCE(cf.aliquota_imposto_vendas, 0) / 100, 2)
    , 2)::NUMERIC AS valor_liquido_calculado,
    COALESCE(ip.qtd_itens, 0)::BIGINT AS qtd_itens,
    -- CMV: NULL se algum item não tem custo
    CASE WHEN ip.todos_tem_custo = TRUE THEN COALESCE(ip.cmv_calculado, 0) ELSE NULL END::NUMERIC AS cmv_total,
    -- Margem: NULL se CMV é NULL
    CASE WHEN ip.todos_tem_custo = TRUE THEN 
      ROUND(
        COALESCE(tv.valor_produto, 0) 
        - COALESCE(ep.comissao_eventos, 0)
        - COALESCE(ep.tarifa_fixa_eventos, 0) 
        - COALESCE(ep.tarifa_financeira_eventos, 0)
        - COALESCE(ep.frete_vendedor_eventos, 0)
        - COALESCE(ep.ads_eventos, 0)
        - ROUND(COALESCE(tv.valor_produto, 0) * COALESCE(cf.aliquota_imposto_vendas, 0) / 100, 2)
        - COALESCE(ip.cmv_calculado, 0)
      , 2)
    ELSE NULL END::NUMERIC AS margem_contribuicao,
    COALESCE(ip.todos_tem_custo, FALSE)::BOOLEAN AS tem_cmv
  FROM transacoes_vendas tv
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = tv.pedido_id
  LEFT JOIN itens_por_pedido ip ON ip.pedido_id = tv.pedido_id
  LEFT JOIN config_fiscal cf ON cf.empresa_id = tv.empresa_id
  ORDER BY tv.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ===========================================================
-- Atualizar a RPC get_vendas_por_pedido_resumo para usar sku_costs
-- ===========================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id UUID DEFAULT NULL,
  p_data_inicio TEXT DEFAULT NULL,
  p_data_fim TEXT DEFAULT NULL
)
RETURNS TABLE(
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
  margem_contribuicao_total NUMERIC,
  pedidos_com_cmv BIGINT,
  pedidos_sem_cmv BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_inicio TIMESTAMPTZ;
  v_data_fim TIMESTAMPTZ;
BEGIN
  IF p_data_inicio IS NOT NULL THEN
    v_data_inicio := public.date_to_br_timestamptz(p_data_inicio);
  ELSE
    v_data_inicio := NOW() - INTERVAL '30 days';
  END IF;
  
  IF p_data_fim IS NOT NULL THEN
    v_data_fim := public.date_to_br_timestamptz(p_data_fim) + INTERVAL '1 day' - INTERVAL '1 second';
  ELSE
    v_data_fim := NOW();
  END IF;

  RETURN QUERY
  WITH transacoes AS (
    SELECT
      mt.pedido_id,
      mt.empresa_id,
      mt.canal,
      mt.valor_bruto
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  eventos AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) END), 0) AS comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(fe.valor) END), 0) AS tarifas,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) END), 0) AS frete,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) END), 0) AS ads
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IS NOT NULL
      AND (p_empresa_id IS NULL OR fe.empresa_id = p_empresa_id)
    GROUP BY fe.pedido_id
  ),
  itens AS (
    SELECT
      mt.pedido_id,
      SUM(mti.quantidade) AS qtd,
      SUM(
        CASE 
          WHEN p.custo_medio IS NOT NULL AND p.custo_medio > 0 THEN mti.quantidade * p.custo_medio
          WHEN sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0 THEN mti.quantidade * sc.custo_unitario
          ELSE NULL
        END
      ) AS cmv,
      BOOL_AND(
        (p.custo_medio IS NOT NULL AND p.custo_medio > 0) OR 
        (sc.custo_unitario IS NOT NULL AND sc.custo_unitario > 0)
      ) AS tem_custo
    FROM marketplace_transactions mt
    JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    LEFT JOIN sku_costs sc ON sc.empresa_id = mt.empresa_id 
      AND sc.sku = mti.sku_marketplace 
      AND sc.canal = mt.canal
    WHERE mt.tipo_transacao = 'venda'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    GROUP BY mt.pedido_id
  ),
  config AS (
    SELECT cf.empresa_id, cf.aliquota_imposto_vendas
    FROM empresas_config_fiscal cf
    WHERE p_empresa_id IS NULL OR cf.empresa_id = p_empresa_id
  )
  SELECT
    COUNT(DISTINCT t.pedido_id)::BIGINT AS total_pedidos,
    COALESCE(SUM(i.qtd), 0)::BIGINT AS total_itens,
    COALESCE(SUM(t.valor_bruto), 0)::NUMERIC AS valor_produto_total,
    COALESCE(SUM(e.comissao), 0)::NUMERIC AS comissao_total,
    COALESCE(SUM(e.tarifas), 0)::NUMERIC AS tarifa_fixa_total,
    COALESCE(SUM(e.frete), 0)::NUMERIC AS frete_vendedor_total,
    COALESCE(SUM(e.ads), 0)::NUMERIC AS ads_total,
    ROUND(COALESCE(SUM(t.valor_bruto), 0) * COALESCE(MAX(c.aliquota_imposto_vendas), 0) / 100, 2)::NUMERIC AS impostos_total,
    ROUND(
      COALESCE(SUM(t.valor_bruto), 0)
      - COALESCE(SUM(e.comissao), 0)
      - COALESCE(SUM(e.tarifas), 0)
      - COALESCE(SUM(e.frete), 0)
      - COALESCE(SUM(e.ads), 0)
      - ROUND(COALESCE(SUM(t.valor_bruto), 0) * COALESCE(MAX(c.aliquota_imposto_vendas), 0) / 100, 2)
    , 2)::NUMERIC AS valor_liquido_total,
    COALESCE(SUM(CASE WHEN i.tem_custo = TRUE THEN i.cmv ELSE 0 END), 0)::NUMERIC AS cmv_total,
    ROUND(
      COALESCE(SUM(t.valor_bruto), 0)
      - COALESCE(SUM(e.comissao), 0)
      - COALESCE(SUM(e.tarifas), 0)
      - COALESCE(SUM(e.frete), 0)
      - COALESCE(SUM(e.ads), 0)
      - ROUND(COALESCE(SUM(t.valor_bruto), 0) * COALESCE(MAX(c.aliquota_imposto_vendas), 0) / 100, 2)
      - COALESCE(SUM(CASE WHEN i.tem_custo = TRUE THEN i.cmv ELSE 0 END), 0)
    , 2)::NUMERIC AS margem_contribuicao_total,
    COUNT(DISTINCT CASE WHEN i.tem_custo = TRUE THEN t.pedido_id END)::BIGINT AS pedidos_com_cmv,
    COUNT(DISTINCT CASE WHEN i.tem_custo IS DISTINCT FROM TRUE THEN t.pedido_id END)::BIGINT AS pedidos_sem_cmv
  FROM transacoes t
  LEFT JOIN eventos e ON e.pedido_id = t.pedido_id
  LEFT JOIN itens i ON i.pedido_id = t.pedido_id
  LEFT JOIN config c ON c.empresa_id = t.empresa_id;
END;
$$;