-- Função para registrar movimento financeiro (com upsert)
CREATE OR REPLACE FUNCTION public.registrar_movimento_financeiro(
  p_data DATE,
  p_tipo movimento_tipo,
  p_origem movimento_origem,
  p_descricao TEXT,
  p_valor NUMERIC,
  p_empresa_id UUID,
  p_referencia_id UUID DEFAULT NULL,
  p_categoria_id UUID DEFAULT NULL,
  p_categoria_nome TEXT DEFAULT NULL,
  p_centro_custo_id UUID DEFAULT NULL,
  p_centro_custo_nome TEXT DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_forma_pagamento TEXT DEFAULT NULL,
  p_cliente_nome TEXT DEFAULT NULL,
  p_fornecedor_nome TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
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