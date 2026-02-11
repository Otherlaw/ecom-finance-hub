
-- Fix SECURITY DEFINER RPCs to validate empresa access
-- Fix get_vendas_com_cmv
CREATE OR REPLACE FUNCTION public.get_vendas_com_cmv(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone, p_canal text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, empresa_id uuid, canal text, canal_venda text, conta_nome text, pedido_id text, data_transacao timestamp with time zone, data_repasse timestamp with time zone, tipo_transacao text, descricao text, status text, referencia_externa text, valor_bruto numeric, valor_liquido numeric, tarifas numeric, taxas numeric, outros_descontos numeric, tipo_lancamento text, categoria_id uuid, centro_custo_id uuid, tipo_envio text, frete_comprador numeric, frete_vendedor numeric, custo_ads numeric, qtd_itens bigint, cmv_total numeric, nao_conciliado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT unnest(public.get_user_empresa_ids()) AS eid
  )
  SELECT 
    mt.id, mt.empresa_id, mt.canal, mt.canal_venda, mt.conta_nome, mt.pedido_id,
    mt.data_transacao, mt.data_repasse, mt.tipo_transacao, mt.descricao, mt.status,
    mt.referencia_externa, mt.valor_bruto, mt.valor_liquido, mt.tarifas, mt.taxas,
    mt.outros_descontos, mt.tipo_lancamento, mt.categoria_id, mt.centro_custo_id,
    mt.tipo_envio, mt.frete_comprador, mt.frete_vendedor, mt.custo_ads,
    COALESCE((SELECT COUNT(*) FROM marketplace_transaction_items mti WHERE mti.transaction_id = mt.id), 0)::bigint as qtd_itens,
    COALESCE((SELECT SUM(mti.quantidade * COALESCE(p.custo_medio, 0)) FROM marketplace_transaction_items mti LEFT JOIN produtos p ON p.id = mti.produto_id WHERE mti.transaction_id = mt.id), 0)::numeric as cmv_total,
    (COALESCE(mt.tarifas, 0) = 0 AND COALESCE(mt.taxas, 0) = 0 AND COALESCE(mt.frete_vendedor, 0) = 0 AND COALESCE(mt.custo_ads, 0) = 0 AND mt.status != 'conciliado') as nao_conciliado
  FROM marketplace_transactions mt
  JOIN allowed a ON mt.empresa_id = a.eid
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

-- Fix get_vendas_count
CREATE OR REPLACE FUNCTION public.get_vendas_count(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone, p_canal text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT unnest(public.get_user_empresa_ids()) AS eid
  )
  SELECT COUNT(*)
  FROM marketplace_transactions mt
  JOIN allowed a ON mt.empresa_id = a.eid
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim
    AND (p_canal IS NULL OR p_canal = 'todos' OR mt.canal = p_canal)
    AND (p_status IS NULL OR p_status = 'todos' OR mt.status = p_status);
$function$;

-- Fix get_vendas_resumo
CREATE OR REPLACE FUNCTION public.get_vendas_resumo(p_empresa_id uuid, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS TABLE(total_bruto numeric, total_liquido numeric, total_tarifas numeric, total_taxas numeric, total_frete_comprador numeric, total_frete_vendedor numeric, total_custo_ads numeric, total_transacoes bigint, transacoes_sem_categoria bigint, transacoes_nao_conciliadas bigint, total_cmv numeric, total_itens bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT unnest(public.get_user_empresa_ids()) AS eid
  )
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
      JOIN allowed a2 ON mt2.empresa_id = a2.eid
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
      JOIN allowed a2 ON mt2.empresa_id = a2.eid
      LEFT JOIN produtos p ON p.id = mti.produto_id
      WHERE (p_empresa_id IS NULL OR mt2.empresa_id = p_empresa_id)
        AND mt2.tipo_lancamento = 'credito'
        AND mt2.data_transacao >= p_data_inicio
        AND mt2.data_transacao < p_data_fim
    ), 0)::bigint as total_itens
  FROM public.marketplace_transactions mt
  JOIN allowed a ON mt.empresa_id = a.eid
  WHERE (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= p_data_inicio
    AND mt.data_transacao < p_data_fim;
$function$;

-- Fix storage: add file size limit and mime type restrictions to product-images bucket
UPDATE storage.buckets 
SET 
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'product-images';
