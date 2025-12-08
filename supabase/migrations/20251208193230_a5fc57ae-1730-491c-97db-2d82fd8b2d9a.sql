-- Criar tabela de fornecedores
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  regime_tributario TEXT,
  tipo TEXT NOT NULL DEFAULT 'mercadoria',
  segmento TEXT NOT NULL DEFAULT 'outros',
  origem TEXT DEFAULT 'cadastro_manual',
  status TEXT NOT NULL DEFAULT 'ativo',
  
  -- Endereço
  endereco_cep TEXT,
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_uf TEXT,
  
  -- Contato
  contato_nome TEXT,
  contato_cargo TEXT,
  contato_email TEXT,
  contato_telefone TEXT,
  contato_celular TEXT,
  
  -- Condições de pagamento
  prazo_medio_dias INTEGER DEFAULT 30,
  forma_pagamento_preferencial TEXT,
  
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow public read fornecedores" 
ON public.fornecedores 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert fornecedores" 
ON public.fornecedores 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update fornecedores" 
ON public.fornecedores 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete fornecedores" 
ON public.fornecedores 
FOR DELETE 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();