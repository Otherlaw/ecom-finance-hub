-- RPC para métricas agregadas de vendas (resumo)
CREATE OR REPLACE FUNCTION public.get_vendas_resumo(
  p_empresa_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
RETURNS TABLE(
  total_bruto numeric,
  total_liquido numeric,
  total_tarifas numeric,
  total_taxas numeric,
  total_frete_comprador numeric,
  total_frete_vendedor numeric,
  total_custo_ads numeric,
  total_transacoes bigint,
  transacoes_sem_categoria bigint,
  transacoes_nao_conciliadas bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    COALESCE(SUM(valor_bruto), 0)::numeric as total_bruto,
    COALESCE(SUM(valor_liquido), 0)::numeric as total_liquido,
    COALESCE(SUM(tarifas), 0)::numeric as total_tarifas,
    COALESCE(SUM(taxas), 0)::numeric as total_taxas,
    COALESCE(SUM(frete_comprador), 0)::numeric as total_frete_comprador,
    COALESCE(SUM(frete_vendedor), 0)::numeric as total_frete_vendedor,
    COALESCE(SUM(custo_ads), 0)::numeric as total_custo_ads,
    COUNT(DISTINCT id)::bigint as total_transacoes,
    COUNT(DISTINCT id) FILTER (WHERE categoria_id IS NULL)::bigint as transacoes_sem_categoria,
    COUNT(DISTINCT id) FILTER (WHERE status != 'conciliado')::bigint as transacoes_nao_conciliadas
  FROM public.marketplace_transactions
  WHERE empresa_id = p_empresa_id
    AND tipo_lancamento = 'credito'
    AND data_transacao >= p_data_inicio
    AND data_transacao < p_data_fim;
$$;

-- RPC para métricas do dashboard (agregado completo)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resultado jsonb;
  v_data_fim_ts timestamptz;
BEGIN
  v_data_fim_ts := (p_data_fim + interval '1 day')::timestamptz;
  
  SELECT jsonb_build_object(
    'receita_bruta', COALESCE(SUM(valor_bruto) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'receita_liquida', COALESCE(SUM(valor_liquido) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'total_tarifas', COALESCE(SUM(COALESCE(tarifas, 0) + COALESCE(taxas, 0) + COALESCE(outros_descontos, 0)) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'total_ads', COALESCE(SUM(custo_ads) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'total_frete_vendedor', COALESCE(SUM(frete_vendedor) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'total_frete_comprador', COALESCE(SUM(frete_comprador) FILTER (WHERE tipo_lancamento = 'credito'), 0),
    'pedidos_unicos', COUNT(DISTINCT pedido_id) FILTER (WHERE tipo_lancamento = 'credito' AND pedido_id IS NOT NULL),
    'total_transacoes', COUNT(*) FILTER (WHERE tipo_lancamento = 'credito'),
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM (
        SELECT 
          canal, 
          COALESCE(SUM(valor_bruto), 0) as bruto,
          COALESCE(SUM(valor_liquido), 0) as liquido,
          COUNT(DISTINCT pedido_id) as pedidos
        FROM marketplace_transactions
        WHERE empresa_id = p_empresa_id
          AND tipo_lancamento = 'credito'
          AND data_transacao >= p_data_inicio::timestamptz
          AND data_transacao < v_data_fim_ts
        GROUP BY canal
      ) canais
    ), '{}'::jsonb)
  ) INTO v_resultado
  FROM marketplace_transactions
  WHERE empresa_id = p_empresa_id
    AND data_transacao >= p_data_inicio::timestamptz
    AND data_transacao < v_data_fim_ts;
  
  RETURN COALESCE(v_resultado, '{}'::jsonb);
END;
$$;

-- Índice composto otimizado para vendas paginadas (se não existir)
CREATE INDEX IF NOT EXISTS idx_mkt_trans_vendas_paginadas 
ON marketplace_transactions(empresa_id, tipo_lancamento, data_transacao DESC, id DESC);

-- Índice para itens por transaction_id (se não existir)
CREATE INDEX IF NOT EXISTS idx_mkt_trans_items_transaction_id 
ON marketplace_transaction_items(transaction_id);