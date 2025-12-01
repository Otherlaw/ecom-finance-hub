-- Create enum for card types
CREATE TYPE public.card_type AS ENUM ('credito', 'debito');

-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('recorrente', 'pontual');

-- Create enum for transaction status
CREATE TYPE public.transaction_status AS ENUM ('conciliado', 'pendente', 'aprovado', 'reprovado');

-- Create categorias_financeiras table
CREATE TABLE public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create centros_de_custo table
CREATE TABLE public.centros_de_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create responsaveis table
CREATE TABLE public.responsaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  funcao TEXT,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_cards table
CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  instituicao_financeira TEXT NOT NULL,
  tipo card_type NOT NULL DEFAULT 'credito',
  limite_credito DECIMAL(15,2),
  dia_fechamento INTEGER NOT NULL,
  dia_vencimento INTEGER NOT NULL,
  responsavel_id UUID REFERENCES public.responsaveis(id),
  empresa_id UUID NOT NULL,
  ultimos_digitos TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_card_invoices table
CREATE TABLE public.credit_card_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  data_fechamento DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  arquivo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  pago BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(credit_card_id, mes_referencia)
);

-- Create credit_card_transactions table
CREATE TABLE public.credit_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.credit_card_invoices(id) ON DELETE CASCADE,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  comprovante_url TEXT,
  tipo transaction_type NOT NULL DEFAULT 'pontual',
  status transaction_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS on all tables
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_de_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for categorias_financeiras
CREATE POLICY "Allow authenticated users to read categorias"
  ON public.categorias_financeiras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert categorias"
  ON public.categorias_financeiras FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update categorias"
  ON public.categorias_financeiras FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for centros_de_custo
CREATE POLICY "Allow authenticated users to read centros"
  ON public.centros_de_custo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert centros"
  ON public.centros_de_custo FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update centros"
  ON public.centros_de_custo FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for responsaveis
CREATE POLICY "Allow authenticated users to read responsaveis"
  ON public.responsaveis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert responsaveis"
  ON public.responsaveis FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update responsaveis"
  ON public.responsaveis FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for credit_cards
CREATE POLICY "Allow authenticated users to read credit_cards"
  ON public.credit_cards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert credit_cards"
  ON public.credit_cards FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update credit_cards"
  ON public.credit_cards FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete credit_cards"
  ON public.credit_cards FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for credit_card_invoices
CREATE POLICY "Allow authenticated users to read invoices"
  ON public.credit_card_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert invoices"
  ON public.credit_card_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update invoices"
  ON public.credit_card_invoices FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete invoices"
  ON public.credit_card_invoices FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for credit_card_transactions
CREATE POLICY "Allow authenticated users to read transactions"
  ON public.credit_card_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert transactions"
  ON public.credit_card_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update transactions"
  ON public.credit_card_transactions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete transactions"
  ON public.credit_card_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_categorias_financeiras_updated_at
  BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_centros_de_custo_updated_at
  BEFORE UPDATE ON public.centros_de_custo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_card_invoices_updated_at
  BEFORE UPDATE ON public.credit_card_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_card_transactions_updated_at
  BEFORE UPDATE ON public.credit_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categorias_financeiras
INSERT INTO public.categorias_financeiras (nome, tipo) VALUES
  ('Embalagens', 'operacional'),
  ('Fornecedores', 'operacional'),
  ('Ferramentas', 'operacional'),
  ('Marketing/Ads', 'marketing'),
  ('Logística', 'operacional'),
  ('Despesas Administrativas', 'administrativa'),
  ('Viagens', 'administrativa'),
  ('Alimentação', 'administrativa'),
  ('Tecnologia', 'operacional'),
  ('Consultorias', 'administrativa');

-- Insert default centros_de_custo
INSERT INTO public.centros_de_custo (nome) VALUES
  ('Inpari'),
  ('Exchange'),
  ('Operação'),
  ('Marketing'),
  ('Administrativo'),
  ('Comercial');