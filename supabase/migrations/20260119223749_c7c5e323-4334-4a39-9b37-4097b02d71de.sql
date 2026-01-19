-- Criar RPC para métricas de vendas agrupadas por tipo de envio
CREATE OR REPLACE FUNCTION public.get_vendas_resumo_por_tipo_envio(
  p_empresa_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
RETURNS TABLE (
  tipo_envio text,
  qtd_transacoes bigint,
  qtd_itens bigint,
  valor_bruto numeric,
  valor_liquido numeric,
  tarifas numeric,
  taxas numeric,
  frete_comprador numeric,
  frete_vendedor numeric,
  custo_ads numeric,
  cmv_total numeric
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COALESCE(LOWER(mt.tipo_envio), 'outros') as tipo_envio,
    COUNT(DISTINCT mt.id)::bigint as qtd_transacoes,
    COALESCE(SUM(mti.quantidade), 0)::bigint as qtd_itens,
    COALESCE(SUM(mt.valor_bruto), 0)::numeric as valor_bruto,
    COALESCE(SUM(mt.valor_liquido), 0)::numeric as valor_liquido,
    COALESCE(SUM(mt.tarifas), 0)::numeric as tarifas,
    COALESCE(SUM(mt.taxas), 0)::numeric as taxas,
    COALESCE(SUM(mt.frete_comprador), 0)::numeric as frete_comprador,
    COALESCE(SUM(mt.frete_vendedor), 0)::numeric as frete_vendedor,
    COALESCE(SUM(mt.custo_ads), 0)::numeric as custo_ads,
    COALESCE(SUM(mti.quantidade * COALESCE(p.custo_medio, 0)), 0)::numeric as cmv_total
  FROM marketplace_transactions mt
  LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
  LEFT JOIN produtos p ON p.id = mti.produto_id
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
  GROUP BY COALESCE(LOWER(mt.tipo_envio), 'outros');
$$;