
-- Tabela de onboarding por empresa (validado)
CREATE TABLE IF NOT EXISTS public.onboarding_empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1,
  step1_completed boolean NOT NULL DEFAULT false,
  step2_completed boolean NOT NULL DEFAULT false,
  step3_completed boolean NOT NULL DEFAULT false,
  onboarding_completo boolean NOT NULL DEFAULT false,
  missing_items jsonb DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_empresa_empresa_id_key UNIQUE (empresa_id)
);

-- RLS
ALTER TABLE public.onboarding_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding_empresa"
  ON public.onboarding_empresa FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own onboarding_empresa"
  ON public.onboarding_empresa FOR INSERT
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own onboarding_empresa"
  ON public.onboarding_empresa FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

-- Trigger updated_at
CREATE TRIGGER update_onboarding_empresa_updated_at
  BEFORE UPDATE ON public.onboarding_empresa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
