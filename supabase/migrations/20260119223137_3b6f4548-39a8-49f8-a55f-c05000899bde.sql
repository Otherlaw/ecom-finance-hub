-- Dropar função existente para permitir alteração dos parâmetros de retorno
DROP FUNCTION IF EXISTS public.get_vendas_resumo(uuid, timestamp with time zone, timestamp with time zone);

-- Recriar com campos adicionais (total_cmv e total_itens)
CREATE OR REPLACE FUNCTION public.get_vendas_resumo(
  p_empresa_id uuid, 
  p_data_inicio timestamp with time zone, 
  p_data_fim timestamp with time zone
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
  transacoes_nao_conciliadas bigint,
  total_cmv numeric,
  total_itens bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(mt.valor_bruto), 0)::numeric as total_bruto,
    COALESCE(SUM(mt.valor_liquido), 0)::numeric as total_liquido,
    COALESCE(SUM(mt.tarifas), 0)::numeric as total_tarifas,
    COALESCE(SUM(mt.taxas), 0)::numeric as total_taxas,
    COALESCE(SUM(mt.frete_comprador), 0)::numeric as total_frete_comprador,
    COALESCE(SUM(mt.frete_vendedor), 0)::numeric as total_frete_vendedor,
    COALESCE(SUM(mt.custo_ads), 0)::numeric as total_custo_ads,
    COUNT(DISTINCT mt.id)::bigint as total_transacoes,
    COUNT(DISTINCT mt.id) FILTER (WHERE mt.categoria_id IS NULL)::bigint as transacoes_sem_categoria,
    COUNT(DISTINCT mt.id) FILTER (WHERE mt.status != 'conciliado')::bigint as transacoes_nao_conciliadas,
    COALESCE((
      SELECT SUM(mti.quantidade * COALESCE(p.custo_medio, 0))
      FROM marketplace_transaction_items mti
      JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
      LEFT JOIN produtos p ON p.id = mti.produto_id
      WHERE (p_empresa_id IS NULL OR mt2.empresa_id = p_empresa_id)
        AND mt2.tipo_lancamento = 'credito'
        AND mt2.data_transacao >= p_data_inicio
        AND mt2.data_transacao < p_data_fim
    ), 0)::numeric as total_cmv,
    COALESCE((
      SELECT SUM(mti.quantidade)
      FROM marketplace_transaction_items mti
      JOIN marketplace_transactions mt2 ON mt2.id = mti.transaction_id
      WHERE (p_empresa_id IS NULL OR mt2.empresa_id = p_empresa_id)
        AND mt2.tipo_lancamento = 'credito'
        AND mt2.data_transacao >= p_data_inicio
        AND mt2.data_transacao < p_data_fim
    ), 0)::bigint as total_itens
  FROM public.marketplace_transactions mt
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim;
$$;