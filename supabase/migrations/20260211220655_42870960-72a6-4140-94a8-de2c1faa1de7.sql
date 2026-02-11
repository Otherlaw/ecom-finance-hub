
-- Fix 1: Make vw_vendas_detalhadas use SECURITY INVOKER so RLS on underlying tables applies
CREATE OR REPLACE VIEW vw_vendas_detalhadas 
WITH (security_invoker = true)
AS
SELECT mt.id AS transacao_id,
    mti.id AS item_id,
    mt.empresa_id,
    mt.canal,
    mt.canal_venda,
    mt.conta_nome,
    mt.pedido_id,
    mt.data_transacao AS data_venda,
    mt.data_repasse,
    mt.tipo_transacao,
    mt.descricao,
    mt.status,
    mt.valor_bruto,
    mt.valor_liquido,
    mt.tarifas,
    mt.taxas,
    mt.outros_descontos,
    mt.tipo_lancamento,
    mt.tipo_envio,
    COALESCE(mt.frete_comprador, 0::numeric) AS frete_comprador,
    COALESCE(mt.frete_vendedor, 0::numeric) AS frete_vendedor,
    COALESCE(mt.custo_ads, 0::numeric) AS custo_ads,
    mti.sku_marketplace,
    mti.anuncio_id,
    mti.descricao_item,
    mti.quantidade,
    mti.preco_unitario,
    mti.preco_total,
    mti.produto_id,
    p.sku AS sku_interno,
    p.nome AS produto_nome,
    p.custo_medio,
    cmv.custo_total AS cmv_total,
    cmv.margem_bruta,
    cmv.margem_percentual,
    CASE WHEN mti.produto_id IS NULL THEN true ELSE false END AS sem_produto_vinculado,
    CASE WHEN p.custo_medio IS NULL OR p.custo_medio = 0::numeric THEN true ELSE false END AS sem_custo,
    CASE WHEN mt.categoria_id IS NULL THEN true ELSE false END AS sem_categoria,
    (mt.status <> 'conciliado'::text) AS nao_conciliado,
    (COALESCE(mt.custo_ads, 0::numeric) > 0::numeric) AS teve_ads
FROM marketplace_transactions mt
LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
LEFT JOIN produtos p ON p.id = mti.produto_id
LEFT JOIN cmv_registros cmv ON cmv.referencia_id = mt.id AND cmv.produto_id = mti.produto_id
WHERE mt.tipo_lancamento = 'credito'
  AND mt.tipo_transacao IN ('venda', 'repasse', 'liberacao')
ORDER BY mt.data_transacao DESC;

-- Fix 2: Add empresa_id access validation to registrar_movimento_financeiro
CREATE OR REPLACE FUNCTION public.registrar_movimento_financeiro(
  p_data date,
  p_tipo text,
  p_origem text,
  p_descricao text,
  p_valor numeric,
  p_empresa_id uuid,
  p_referencia_id uuid DEFAULT NULL,
  p_categoria_id uuid DEFAULT NULL,
  p_categoria_nome text DEFAULT NULL,
  p_centro_custo_id uuid DEFAULT NULL,
  p_centro_custo_nome text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_cliente_nome text DEFAULT NULL,
  p_fornecedor_nome text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validar campos obrigatórios
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Campo data é obrigatório';
  END IF;
  
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Campo valor deve ser maior que zero';
  END IF;
  
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Campo empresa_id é obrigatório';
  END IF;

  -- SECURITY: Validar acesso do usuário à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não tem permissão para esta empresa';
  END IF;

  -- Upsert: inserir ou atualizar se já existir
  INSERT INTO public.movimentos_financeiros (
    data, tipo, origem, descricao, valor, empresa_id, referencia_id,
    categoria_id, categoria_nome, centro_custo_id, centro_custo_nome,
    responsavel_id, forma_pagamento, cliente_nome, fornecedor_nome, observacoes
  )
  VALUES (
    p_data, p_tipo, p_origem, p_descricao, p_valor, p_empresa_id, p_referencia_id,
    p_categoria_id, p_categoria_nome, p_centro_custo_id, p_centro_custo_nome,
    p_responsavel_id, p_forma_pagamento, p_cliente_nome, p_fornecedor_nome, p_observacoes
  )
  ON CONFLICT (referencia_id, origem) 
  DO UPDATE SET
    data = EXCLUDED.data,
    tipo = EXCLUDED.tipo,
    descricao = EXCLUDED.descricao,
    valor = EXCLUDED.valor,
    categoria_id = EXCLUDED.categoria_id,
    categoria_nome = EXCLUDED.categoria_nome,
    centro_custo_id = EXCLUDED.centro_custo_id,
    centro_custo_nome = EXCLUDED.centro_custo_nome,
    responsavel_id = EXCLUDED.responsavel_id,
    forma_pagamento = EXCLUDED.forma_pagamento,
    cliente_nome = EXCLUDED.cliente_nome,
    fornecedor_nome = EXCLUDED.fornecedor_nome,
    observacoes = EXCLUDED.observacoes,
    atualizado_em = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
