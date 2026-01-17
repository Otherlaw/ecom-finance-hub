-- Função RPC para métricas do fechamento mensal
-- Retorna dados agregados em uma única chamada, evitando carregar milhares de registros

CREATE OR REPLACE FUNCTION public.get_fechamento_metrics(
  p_empresa_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  SELECT jsonb_build_object(
    'marketplace', jsonb_build_object(
      'total_transacoes', COALESCE(COUNT(*), 0),
      'total_creditos', COALESCE(SUM(valor_liquido) FILTER (WHERE tipo_lancamento = 'credito'), 0),
      'total_debitos', COALESCE(SUM(ABS(valor_liquido)) FILTER (WHERE tipo_lancamento = 'debito'), 0),
      'total_bruto', COALESCE(SUM(valor_bruto) FILTER (WHERE tipo_lancamento = 'credito'), 0),
      'total_tarifas', COALESCE(SUM(COALESCE(tarifas, 0)), 0),
      'total_taxas', COALESCE(SUM(COALESCE(taxas, 0)), 0),
      'total_frete_comprador', COALESCE(SUM(COALESCE(frete_comprador, 0)), 0),
      'total_frete_vendedor', COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0),
      'total_custo_ads', COALESCE(SUM(COALESCE(custo_ads, 0)), 0),
      'conciliadas', COALESCE(COUNT(*) FILTER (WHERE status = 'conciliado'), 0),
      'pendentes', COALESCE(COUNT(*) FILTER (WHERE status IN ('importado', 'pendente')), 0)
    ),
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, canal_data)
      FROM (
        SELECT 
          canal,
          jsonb_build_object(
            'receita_bruta', COALESCE(SUM(valor_bruto) FILTER (WHERE tipo_lancamento = 'credito'), 0),
            'receita_liquida', COALESCE(SUM(valor_liquido) FILTER (WHERE tipo_lancamento = 'credito'), 0),
            'tarifas', COALESCE(SUM(COALESCE(tarifas, 0) + COALESCE(taxas, 0)), 0),
            'total_transacoes', COUNT(*)
          ) as canal_data
        FROM marketplace_transactions
        WHERE empresa_id = p_empresa_id
          AND data_transacao >= p_data_inicio
          AND data_transacao < p_data_fim
          AND status != 'ignorado'
        GROUP BY canal
      ) canais
    ), '{}'::jsonb)
  ) INTO v_resultado
  FROM marketplace_transactions
  WHERE empresa_id = p_empresa_id
    AND data_transacao >= p_data_inicio
    AND data_transacao < p_data_fim
    AND status != 'ignorado';
  
  RETURN COALESCE(v_resultado, jsonb_build_object(
    'marketplace', jsonb_build_object(
      'total_transacoes', 0,
      'total_creditos', 0,
      'total_debitos', 0,
      'total_bruto', 0,
      'total_tarifas', 0,
      'total_taxas', 0,
      'total_frete_comprador', 0,
      'total_frete_vendedor', 0,
      'total_custo_ads', 0,
      'conciliadas', 0,
      'pendentes', 0
    ),
    'por_canal', '{}'::jsonb
  ));
END;
$$;