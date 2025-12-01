-- Criar tabela de empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  inscricao_estadual TEXT,
  regime_tributario TEXT NOT NULL CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Políticas para empresas
CREATE POLICY "Allow authenticated users to read empresas"
ON public.empresas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert empresas"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update empresas"
ON public.empresas FOR UPDATE
TO authenticated
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar empresa_id aos cartões
ALTER TABLE public.credit_cards
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Adicionar campos adicionais às faturas
ALTER TABLE public.credit_card_invoices
ADD COLUMN IF NOT EXISTS competencia TEXT,
ADD COLUMN IF NOT EXISTS arquivo_importacao_url TEXT;

-- Adicionar campos adicionais às transações
ALTER TABLE public.credit_card_transactions
ADD COLUMN IF NOT EXISTS estabelecimento TEXT,
ADD COLUMN IF NOT EXISTS numero_parcela TEXT,
ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS data_lancamento DATE,
ADD COLUMN IF NOT EXISTS tipo_despesa TEXT CHECK (tipo_despesa IN ('recorrente', 'pontual', 'assinatura', 'viagem', 'outros'));

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_credit_cards_empresa ON public.credit_cards(empresa_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_invoices_card ON public.credit_card_invoices(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_invoices_competencia ON public.credit_card_invoices(competencia);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_invoice ON public.credit_card_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_status ON public.credit_card_transactions(status);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_categoria ON public.credit_card_transactions(categoria_id);