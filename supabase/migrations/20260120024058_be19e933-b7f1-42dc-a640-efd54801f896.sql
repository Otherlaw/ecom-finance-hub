
-- ==========================================================
-- MIGRATION: Padronizar timestamps do checklist_etapas
-- ==========================================================

-- 1. Renomear colunas para padrão criado_em/atualizado_em
ALTER TABLE public.checklist_etapas 
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE public.checklist_etapas 
  RENAME COLUMN updated_at TO atualizado_em;

-- 2. Remover triggers antigos que possam existir
DROP TRIGGER IF EXISTS update_checklist_etapas_updated_at ON public.checklist_etapas;
DROP TRIGGER IF EXISTS update_updated_at_checklist_etapas ON public.checklist_etapas;
DROP TRIGGER IF EXISTS set_checklist_etapas_updated_at ON public.checklist_etapas;

-- 3. Criar trigger correto usando a função padronizada
CREATE TRIGGER update_checklist_etapas_atualizado_em
  BEFORE UPDATE ON public.checklist_etapas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();

-- 4. Garantir que checklist_canal_arquivos tenha a coluna atualizado_em
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checklist_canal_arquivos' 
    AND column_name = 'atualizado_em'
  ) THEN
    ALTER TABLE public.checklist_canal_arquivos 
    ADD COLUMN atualizado_em TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 5. Criar trigger para checklist_canal_arquivos se não existir
DROP TRIGGER IF EXISTS update_checklist_canal_arquivos_atualizado_em ON public.checklist_canal_arquivos;

CREATE TRIGGER update_checklist_canal_arquivos_atualizado_em
  BEFORE UPDATE ON public.checklist_canal_arquivos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();
