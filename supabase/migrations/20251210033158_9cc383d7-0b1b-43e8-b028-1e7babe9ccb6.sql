-- Adicionar campo bloqueia_fechamento às etapas do checklist por canal
-- Etapas com bloqueia_fechamento = true precisam estar concluídas para permitir o fechamento do mês

ALTER TABLE public.checklist_canal_itens
ADD COLUMN IF NOT EXISTS bloqueia_fechamento BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.checklist_canal_itens.bloqueia_fechamento IS 
  'Se true, esta etapa precisa estar concluída (ou N/A) para permitir o fechamento do mês';