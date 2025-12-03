-- Criar tabela de contas a pagar
CREATE TABLE public.contas_a_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  fornecedor_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  documento TEXT,
  tipo_lancamento TEXT NOT NULL DEFAULT 'despesa_operacional',
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_total NUMERIC NOT NULL,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  valor_em_aberto NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_aberto',
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  forma_pagamento TEXT,
  observacoes TEXT,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contas_a_pagar_empresa ON public.contas_a_pagar(empresa_id);
CREATE INDEX idx_contas_a_pagar_status ON public.contas_a_pagar(status);
CREATE INDEX idx_contas_a_pagar_vencimento ON public.contas_a_pagar(data_vencimento);
CREATE INDEX idx_contas_a_pagar_pagamento ON public.contas_a_pagar(data_pagamento);

-- Habilitar RLS
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público para desenvolvimento)
CREATE POLICY "Allow public read contas_a_pagar"
  ON public.contas_a_pagar FOR SELECT USING (true);

CREATE POLICY "Allow public insert contas_a_pagar"
  ON public.contas_a_pagar FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update contas_a_pagar"
  ON public.contas_a_pagar FOR UPDATE USING (true);

CREATE POLICY "Allow public delete contas_a_pagar"
  ON public.contas_a_pagar FOR DELETE USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contas_a_pagar_updated_at
  BEFORE UPDATE ON public.contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário
COMMENT ON TABLE public.contas_a_pagar IS 'Tabela de contas a pagar para controle de despesas e integração com Fluxo de Caixa';