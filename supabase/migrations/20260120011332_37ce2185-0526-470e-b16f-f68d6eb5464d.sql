-- Criar função correta para atualizar atualizado_em
CREATE OR REPLACE FUNCTION public.set_checklist_import_jobs_atualizado_em()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo que usa updated_at (coluna inexistente)
DROP TRIGGER IF EXISTS update_checklist_import_jobs_updated_at 
  ON public.checklist_import_jobs;

-- Criar trigger correto usando atualizado_em
CREATE TRIGGER set_checklist_import_jobs_atualizado_em
  BEFORE UPDATE ON public.checklist_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_checklist_import_jobs_atualizado_em();