-- Corrigir triggers do checklist que usam updated_at ao invés de atualizado_em

-- 1) Garantir que a função correta existe
CREATE OR REPLACE FUNCTION public.update_atualizado_em_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- 2) Remover triggers errados (que usam update_updated_at_column)
DROP TRIGGER IF EXISTS update_checklists_canal_updated_at ON public.checklists_canal;
DROP TRIGGER IF EXISTS update_checklist_canal_itens_updated_at ON public.checklist_canal_itens;

-- 3) Criar triggers corretos
CREATE TRIGGER update_checklists_canal_atualizado_em
  BEFORE UPDATE ON public.checklists_canal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();

CREATE TRIGGER update_checklist_canal_itens_atualizado_em
  BEFORE UPDATE ON public.checklist_canal_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();