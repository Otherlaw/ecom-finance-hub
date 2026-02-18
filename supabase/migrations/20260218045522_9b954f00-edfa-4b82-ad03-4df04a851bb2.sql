
-- 1. Adicionar colunas rebate e bonus_envio na marketplace_transactions
ALTER TABLE public.marketplace_transactions
  ADD COLUMN IF NOT EXISTS rebate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_envio numeric DEFAULT 0;

-- 2. Garantir RLS na empresa_logistica_config (já existe, mas pode não ter políticas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'empresa_logistica_config'
  ) THEN
    CREATE TABLE public.empresa_logistica_config (
      empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
      flex_custo numeric NOT NULL DEFAULT 0,
      flex_turbo_custo numeric NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Habilitar RLS (idempotente)
ALTER TABLE public.empresa_logistica_config ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para recriar limpas
DROP POLICY IF EXISTS "Users can read own logistica_config" ON public.empresa_logistica_config;
DROP POLICY IF EXISTS "Users can insert own logistica_config" ON public.empresa_logistica_config;
DROP POLICY IF EXISTS "Users can update own logistica_config" ON public.empresa_logistica_config;
DROP POLICY IF EXISTS "Users can delete own logistica_config" ON public.empresa_logistica_config;

CREATE POLICY "Users can read own logistica_config"
  ON public.empresa_logistica_config FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own logistica_config"
  ON public.empresa_logistica_config FOR INSERT
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own logistica_config"
  ON public.empresa_logistica_config FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own logistica_config"
  ON public.empresa_logistica_config FOR DELETE
  USING (user_has_empresa_access(empresa_id));

-- 3. Trigger para updated_at na empresa_logistica_config
CREATE OR REPLACE FUNCTION public.set_logistica_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_logistica_config_updated_at ON public.empresa_logistica_config;
CREATE TRIGGER trg_logistica_config_updated_at
  BEFORE UPDATE ON public.empresa_logistica_config
  FOR EACH ROW EXECUTE FUNCTION public.set_logistica_config_updated_at();
