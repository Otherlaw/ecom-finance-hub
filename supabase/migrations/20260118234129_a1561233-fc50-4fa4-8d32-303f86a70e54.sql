-- ETAPA 1: Atualizar RPC get_dashboard_metrics para receber timestamptz ao invés de DATE
-- Isso corrige o problema de fuso horário onde "Hoje" pegava parte de ontem

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_empresa_id uuid, 
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resultado jsonb;
BEGIN
  -- Agora recebemos timestamptz diretamente, sem necessidade de conversões
  -- Filtro: data_transacao >= p_data_inicio AND data_transacao < p_data_fim (exclusivo)
  
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
          AND data_transacao >= p_data_inicio
          AND data_transacao < p_data_fim
        GROUP BY canal
      ) canais
    ), '{}'::jsonb)
  ) INTO v_resultado
  FROM marketplace_transactions
  WHERE empresa_id = p_empresa_id
    AND data_transacao >= p_data_inicio
    AND data_transacao < p_data_fim;
  
  RETURN COALESCE(v_resultado, '{}'::jsonb);
END;
$function$;