-- Dropar triggers antigos que podem estar causando o erro
DROP TRIGGER IF EXISTS update_checklist_etapas_updated_at ON public.checklist_etapas;
DROP TRIGGER IF EXISTS set_checklist_etapas_updated_at ON public.checklist_etapas;
DROP TRIGGER IF EXISTS update_checklist_etapas_atualizado_em ON public.checklist_etapas;

-- Criar função específica se não existir (mais seguro que depender da genérica)
CREATE OR REPLACE FUNCTION public.set_checklist_etapas_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Criar trigger correto
CREATE TRIGGER update_checklist_etapas_atualizado_em
  BEFORE UPDATE ON public.checklist_etapas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_checklist_etapas_atualizado_em();