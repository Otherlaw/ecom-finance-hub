-- Criar tabela bank_transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  data_transacao DATE NOT NULL,
  data_competencia DATE,
  descricao TEXT NOT NULL,
  documento TEXT,
  valor NUMERIC(14,2) NOT NULL,
  tipo_lancamento TEXT NOT NULL CHECK (tipo_lancamento IN ('debito', 'credito')),
  status TEXT NOT NULL DEFAULT 'importado' CHECK (status IN ('importado', 'pendente', 'conciliado', 'ignorado')),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  origem_extrato TEXT NOT NULL CHECK (origem_extrato IN ('arquivo_ofx', 'arquivo_csv', 'manual')),
  referencia_externa TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_bank_transactions_empresa_data ON public.bank_transactions(empresa_id, data_transacao);
CREATE INDEX idx_bank_transactions_conta_data ON public.bank_transactions(conta_id, data_transacao);
CREATE INDEX idx_bank_transactions_referencia ON public.bank_transactions(referencia_externa);

-- Habilitar RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (mesmo padrão das outras tabelas)
CREATE POLICY "Allow public read bank_transactions" ON public.bank_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert bank_transactions" ON public.bank_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update bank_transactions" ON public.bank_transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete bank_transactions" ON public.bank_transactions FOR DELETE USING (true);

-- Trigger para atualizar atualizado_em
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();