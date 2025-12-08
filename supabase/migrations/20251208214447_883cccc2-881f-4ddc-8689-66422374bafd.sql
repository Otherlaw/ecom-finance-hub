-- Create ICMS credits table
CREATE TABLE public.creditos_icms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  
  -- Credit classification
  tipo_credito TEXT NOT NULL CHECK (tipo_credito IN ('compensavel', 'nao_compensavel')),
  origem_credito TEXT NOT NULL CHECK (origem_credito IN ('compra_mercadoria', 'devolucao_venda', 'frete', 'nota_adquirida', 'outro')),
  status_credito TEXT NOT NULL DEFAULT 'ativo' CHECK (status_credito IN ('ativo', 'estornado', 'compensado', 'expirado')),
  
  -- NF data
  chave_acesso TEXT,
  numero_nf TEXT,
  
  -- Item/operation data
  ncm TEXT NOT NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  uf_origem TEXT,
  cfop TEXT,
  
  -- ICMS values
  aliquota_icms NUMERIC NOT NULL DEFAULT 0,
  valor_icms_destacado NUMERIC NOT NULL DEFAULT 0,
  percentual_aproveitamento NUMERIC NOT NULL DEFAULT 100,
  valor_credito_bruto NUMERIC NOT NULL DEFAULT 0,
  valor_ajustes NUMERIC NOT NULL DEFAULT 0,
  valor_credito NUMERIC NOT NULL DEFAULT 0,
  
  -- Control
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia TEXT NOT NULL,
  observacoes TEXT,
  
  -- Supplier link (for acquired notes)
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  fornecedor_nome TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creditos_icms ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (development)
CREATE POLICY "Allow public read creditos_icms" ON public.creditos_icms FOR SELECT USING (true);
CREATE POLICY "Allow public insert creditos_icms" ON public.creditos_icms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update creditos_icms" ON public.creditos_icms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete creditos_icms" ON public.creditos_icms FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_creditos_icms_updated_at
  BEFORE UPDATE ON public.creditos_icms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_creditos_icms_empresa ON public.creditos_icms(empresa_id);
CREATE INDEX idx_creditos_icms_tipo ON public.creditos_icms(tipo_credito);
CREATE INDEX idx_creditos_icms_status ON public.creditos_icms(status_credito);
CREATE INDEX idx_creditos_icms_chave ON public.creditos_icms(chave_acesso);
CREATE INDEX idx_creditos_icms_competencia ON public.creditos_icms(data_competencia);