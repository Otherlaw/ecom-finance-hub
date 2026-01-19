-- Atualizar get_dashboard_metrics para suportar p_empresa_id = NULL (todas as empresas)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultado jsonb;
BEGIN
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
        WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
          AND tipo_lancamento = 'credito'
          AND data_transacao >= p_data_inicio
          AND data_transacao < p_data_fim
        GROUP BY canal
      ) canais
    ), '{}'::jsonb)
  ) INTO v_resultado
  FROM marketplace_transactions
  WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND data_transacao >= p_data_inicio
    AND data_transacao < p_data_fim;
  
  RETURN COALESCE(v_resultado, '{}'::jsonb);
END;
$function$;

-- Atualizar get_fechamento_metrics para suportar p_empresa_id = NULL (todas as empresas)
CREATE OR REPLACE FUNCTION public.get_fechamento_metrics(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
          AND data_transacao >= p_data_inicio
          AND data_transacao < p_data_fim
          AND status != 'ignorado'
        GROUP BY canal
      ) canais
    ), '{}'::jsonb)
  ) INTO v_resultado
  FROM marketplace_transactions
  WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
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
$function$;

-- Atualizar get_vendas_resumo para suportar empresa NULL
CREATE OR REPLACE FUNCTION public.get_vendas_resumo(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS TABLE(total_bruto numeric, total_liquido numeric, total_tarifas numeric, total_taxas numeric, total_frete_comprador numeric, total_frete_vendedor numeric, total_custo_ads numeric, total_transacoes bigint, transacoes_sem_categoria bigint, transacoes_nao_conciliadas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND tipo_lancamento = 'credito'
    AND data_transacao >= p_data_inicio
    AND data_transacao < p_data_fim;
$function$;

-- Atualizar get_vendas_count para suportar empresa NULL  
CREATE OR REPLACE FUNCTION public.get_vendas_count(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone, p_canal text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)
  FROM marketplace_transactions mt
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
    AND (p_canal IS NULL OR p_canal = 'todos' OR mt.canal = p_canal)
    AND (p_status IS NULL OR p_status = 'todos' OR mt.status = p_status);
$function$;

-- Atualizar get_vendas_com_cmv para suportar empresa NULL
CREATE OR REPLACE FUNCTION public.get_vendas_com_cmv(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone, p_canal text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, empresa_id uuid, canal text, canal_venda text, conta_nome text, pedido_id text, data_transacao timestamp with time zone, data_repasse timestamp with time zone, tipo_transacao text, descricao text, status text, referencia_externa text, valor_bruto numeric, valor_liquido numeric, tarifas numeric, taxas numeric, outros_descontos numeric, tipo_lancamento text, categoria_id uuid, centro_custo_id uuid, tipo_envio text, frete_comprador numeric, frete_vendedor numeric, custo_ads numeric, qtd_itens bigint, cmv_total numeric, nao_conciliado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
    AND (p_canal IS NULL OR p_canal = 'todos' OR mt.canal = p_canal)
    AND (p_status IS NULL OR p_status = 'todos' OR mt.status = p_status)
  ORDER BY mt.data_transacao DESC, mt.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$function$;