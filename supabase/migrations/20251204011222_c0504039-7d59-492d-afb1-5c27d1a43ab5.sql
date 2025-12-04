-- Criar enum para tipo de movimento
CREATE TYPE public.movimento_tipo AS ENUM ('entrada', 'saida');

-- Criar enum para origem do movimento
CREATE TYPE public.movimento_origem AS ENUM ('cartao', 'banco', 'contas_pagar', 'contas_receber', 'marketplace', 'manual');

-- Criar tabela movimentos_financeiros (Motor de Entrada Unificada)
CREATE TABLE public.movimentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  tipo movimento_tipo NOT NULL,
  origem movimento_origem NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor > 0),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  categoria_nome TEXT,
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  centro_custo_nome TEXT,
  responsavel_id UUID REFERENCES public.responsaveis(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  referencia_id UUID,
  forma_pagamento TEXT,
  cliente_nome TEXT,
  fornecedor_nome TEXT,
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint única para evitar duplicatas
  UNIQUE (referencia_id, origem)
);

-- Índices para performance
CREATE INDEX idx_movimentos_data ON public.movimentos_financeiros(data);
CREATE INDEX idx_movimentos_tipo ON public.movimentos_financeiros(tipo);
CREATE INDEX idx_movimentos_origem ON public.movimentos_financeiros(origem);
CREATE INDEX idx_movimentos_empresa ON public.movimentos_financeiros(empresa_id);
CREATE INDEX idx_movimentos_categoria ON public.movimentos_financeiros(categoria_id);
CREATE INDEX idx_movimentos_centro_custo ON public.movimentos_financeiros(centro_custo_id);
CREATE INDEX idx_movimentos_referencia ON public.movimentos_financeiros(referencia_id);

-- Habilitar RLS
ALTER TABLE public.movimentos_financeiros ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow public read movimentos" ON public.movimentos_financeiros
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert movimentos" ON public.movimentos_financeiros
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update movimentos" ON public.movimentos_financeiros
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete movimentos" ON public.movimentos_financeiros
  FOR DELETE USING (true);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_movimentos_updated_at
  BEFORE UPDATE ON public.movimentos_financeiros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para registrar ou atualizar movimento financeiro (upsert)
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