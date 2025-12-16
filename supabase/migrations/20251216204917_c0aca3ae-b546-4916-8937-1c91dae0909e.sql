-- Tabela para origens de crédito personalizadas
CREATE TABLE public.origens_credito_icms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.origens_credito_icms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own origens_credito" ON public.origens_credito_icms
FOR SELECT USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own origens_credito" ON public.origens_credito_icms
FOR INSERT WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own origens_credito" ON public.origens_credito_icms
FOR UPDATE USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own origens_credito" ON public.origens_credito_icms
FOR DELETE USING (user_has_empresa_access(empresa_id));

-- Trigger para updated_at
CREATE TRIGGER update_origens_credito_updated_at
BEFORE UPDATE ON public.origens_credito_icms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();