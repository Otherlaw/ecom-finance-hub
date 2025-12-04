-- Criar tabela marketplace_transactions
CREATE TABLE public.marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  canal TEXT NOT NULL,
  conta_nome TEXT,
  pedido_id TEXT,
  referencia_externa TEXT,
  data_transacao DATE NOT NULL,
  data_repasse DATE,
  tipo_transacao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_bruto NUMERIC(14,2),
  valor_liquido NUMERIC(14,2) NOT NULL,
  tipo_lancamento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'importado',
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  origem_arquivo TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_marketplace_transactions_empresa_canal_data ON public.marketplace_transactions(empresa_id, canal, data_transacao);
CREATE INDEX idx_marketplace_transactions_empresa_pedido ON public.marketplace_transactions(empresa_id, pedido_id);
CREATE INDEX idx_marketplace_transactions_empresa_ref ON public.marketplace_transactions(empresa_id, referencia_externa);

-- Enable RLS
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read marketplace_transactions" ON public.marketplace_transactions
FOR SELECT USING (true);

CREATE POLICY "Allow public insert marketplace_transactions" ON public.marketplace_transactions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update marketplace_transactions" ON public.marketplace_transactions
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete marketplace_transactions" ON public.marketplace_transactions
FOR DELETE USING (true);