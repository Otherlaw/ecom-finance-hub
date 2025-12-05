-- Tabela para regras de categorização automática de marketplace
CREATE TABLE public.marketplace_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  canal TEXT NOT NULL CHECK (canal IN ('mercado_livre', 'mercado_pago', 'shopee', 'shein', 'tiktok_shop')),
  texto_contem TEXT NOT NULL,
  tipo_lancamento TEXT NOT NULL CHECK (tipo_lancamento IN ('credito', 'debito')),
  tipo_transacao TEXT,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read marketplace_rules" 
ON public.marketplace_rules 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert marketplace_rules" 
ON public.marketplace_rules 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update marketplace_rules" 
ON public.marketplace_rules 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete marketplace_rules" 
ON public.marketplace_rules 
FOR DELETE 
USING (true);

-- Index for faster lookups
CREATE INDEX idx_marketplace_rules_empresa_canal ON public.marketplace_rules(empresa_id, canal);
CREATE INDEX idx_marketplace_rules_ativo ON public.marketplace_rules(ativo) WHERE ativo = true;