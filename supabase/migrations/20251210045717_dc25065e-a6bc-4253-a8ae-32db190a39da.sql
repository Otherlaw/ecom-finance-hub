-- Tabela para rastrear progresso de tutoriais dos usuários
CREATE TABLE public.tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id TEXT NOT NULL,
  step_atual INTEGER DEFAULT 0,
  concluido BOOLEAN DEFAULT false,
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tutorial_id)
);

-- Habilitar RLS
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Política: usuários gerenciam seu próprio progresso
CREATE POLICY "Users can manage own tutorial progress"
  ON public.tutorial_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_tutorial_progress_updated_at
  BEFORE UPDATE ON public.tutorial_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();