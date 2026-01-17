-- ETAPA 5: RPC para buscar vendas com CMV agregado
-- CMV é calculado via join: quantidade * custo_medio do produto

CREATE OR REPLACE FUNCTION public.get_vendas_com_cmv(
  p_empresa_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_canal text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  canal text,
  canal_venda text,
  conta_nome text,
  pedido_id text,
  data_transacao timestamptz,
  data_repasse timestamptz,
  tipo_transacao text,
  descricao text,
  status text,
  referencia_externa text,
  valor_bruto numeric,
  valor_liquido numeric,
  tarifas numeric,
  taxas numeric,
  outros_descontos numeric,
  tipo_lancamento text,
  categoria_id uuid,
  centro_custo_id uuid,
  tipo_envio text,
  frete_comprador numeric,
  frete_vendedor numeric,
  custo_ads numeric,
  qtd_itens bigint,
  cmv_total numeric,
  nao_conciliado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    mt.id,
    mt.empresa_id,
    mt.canal,
    mt.canal_venda,
    mt.conta_nome,
    mt.pedido_id,
    mt.data_transacao,
    mt.data_repasse,
    mt.tipo_transacao,
    mt.descricao,
    mt.status,
    mt.referencia_externa,
    mt.valor_bruto,
    mt.valor_liquido,
    mt.tarifas,
    mt.taxas,
    mt.outros_descontos,
    mt.tipo_lancamento,
    mt.categoria_id,
    mt.centro_custo_id,
    mt.tipo_envio,
    mt.frete_comprador,
    mt.frete_vendedor,
    mt.custo_ads,
    COALESCE((
      SELECT COUNT(*) FROM marketplace_transaction_items mti WHERE mti.transaction_id = mt.id
    ), 0)::bigint as qtd_itens,
    COALESCE((
      SELECT SUM(mti.quantidade * COALESCE(p.custo_medio, 0))
      FROM marketplace_transaction_items mti
      LEFT JOIN produtos p ON p.id = mti.produto_id
      WHERE mti.transaction_id = mt.id
    ), 0)::numeric as cmv_total,
    (
      COALESCE(mt.tarifas, 0) = 0 
      AND COALESCE(mt.taxas, 0) = 0 
      AND COALESCE(mt.frete_vendedor, 0) = 0 
      AND COALESCE(mt.custo_ads, 0) = 0 
      AND mt.status != 'conciliado'
    ) as nao_conciliado
  FROM marketplace_transactions mt
  WHERE mt.empresa_id = p_empresa_id
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
    AND (p_canal IS NULL OR p_canal = 'todos' OR mt.canal = p_canal)
    AND (p_status IS NULL OR p_status = 'todos' OR mt.status = p_status)
  ORDER BY mt.data_transacao DESC, mt.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Função para contar total (mais rápido que count exact)
CREATE OR REPLACE FUNCTION public.get_vendas_count(
  p_empresa_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_canal text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM marketplace_transactions mt
  WHERE mt.empresa_id = p_empresa_id
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
    AND (p_canal IS NULL OR p_canal = 'todos' OR mt.canal = p_canal)
    AND (p_status IS NULL OR p_status = 'todos' OR mt.status = p_status);
$$;