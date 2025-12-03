-- Criar tabela de contas a receber para registrar receitas/entradas
CREATE TABLE public.contas_a_receber (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  cliente_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  documento TEXT,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  valor_total NUMERIC NOT NULL,
  valor_recebido NUMERIC NOT NULL DEFAULT 0,
  valor_em_aberto NUMERIC NOT NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  forma_recebimento TEXT,
  status TEXT NOT NULL DEFAULT 'em_aberto',
  tipo_lancamento TEXT NOT NULL DEFAULT 'receita_venda',
  origem TEXT DEFAULT 'manual',
  observacoes TEXT,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.contas_a_receber ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow public read contas_a_receber" 
ON public.contas_a_receber FOR SELECT USING (true);

CREATE POLICY "Allow public insert contas_a_receber" 
ON public.contas_a_receber FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update contas_a_receber" 
ON public.contas_a_receber FOR UPDATE USING (true);

CREATE POLICY "Allow public delete contas_a_receber" 
ON public.contas_a_receber FOR DELETE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_contas_a_receber_updated_at
BEFORE UPDATE ON public.contas_a_receber
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.contas_a_receber IS 'Tabela de contas a receber para controle de receitas e entradas no fluxo de caixa';
COMMENT ON COLUMN public.contas_a_receber.status IS 'Status: em_aberto, parcialmente_recebido, recebido, vencido, cancelado';
COMMENT ON COLUMN public.contas_a_receber.tipo_lancamento IS 'Tipo: receita_venda, receita_servico, receita_marketplace, outras_receitas';
COMMENT ON COLUMN public.contas_a_receber.origem IS 'Origem: manual, marketplace, nfe, boleto';