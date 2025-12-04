-- Tabela manual_transactions (fonte de movimentações manuais)
CREATE TABLE IF NOT EXISTS public.manual_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_manual_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manual_transactions_updated_at ON public.manual_transactions;

CREATE TRIGGER trg_manual_transactions_updated_at
BEFORE UPDATE ON public.manual_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_manual_transactions_updated_at();

-- RLS
ALTER TABLE public.manual_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read manual_transactions" 
ON public.manual_transactions FOR SELECT USING (true);

CREATE POLICY "Allow public insert manual_transactions" 
ON public.manual_transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update manual_transactions" 
ON public.manual_transactions FOR UPDATE USING (true);

CREATE POLICY "Allow public delete manual_transactions" 
ON public.manual_transactions FOR DELETE USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_manual_transactions_empresa_id ON public.manual_transactions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manual_transactions_data ON public.manual_transactions(data);
CREATE INDEX IF NOT EXISTS idx_manual_transactions_tipo ON public.manual_transactions(tipo);