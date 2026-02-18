
-- Tabela de configuração de custo logístico por empresa (FLEX / FLEX TURBO)
CREATE TABLE IF NOT EXISTS public.empresa_logistica_config (
  empresa_id       uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  flex_custo       numeric NOT NULL DEFAULT 0,
  flex_turbo_custo numeric NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.empresa_logistica_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver config logistica da sua empresa"
  ON public.empresa_logistica_config
  FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios admin/dono podem alterar config logistica"
  ON public.empresa_logistica_config
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresas
      WHERE user_id = auth.uid()
        AND role_na_empresa IN ('dono', 'admin')
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresas
      WHERE user_id = auth.uid()
        AND role_na_empresa IN ('dono', 'admin')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_empresa_logistica_config_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empresa_logistica_config_updated_at
  BEFORE UPDATE ON public.empresa_logistica_config
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_logistica_config_updated_at();
