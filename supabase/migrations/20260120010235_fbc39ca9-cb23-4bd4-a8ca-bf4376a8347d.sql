-- Tabela para rastrear jobs de importação do checklist
CREATE TABLE public.checklist_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_canal_itens(id) ON DELETE CASCADE,
  arquivo_id UUID REFERENCES public.checklist_canal_arquivos(id) ON DELETE SET NULL,
  arquivo_nome TEXT NOT NULL,
  canal TEXT NOT NULL,
  
  -- Progresso
  total_linhas INTEGER NOT NULL DEFAULT 0,
  linhas_processadas INTEGER NOT NULL DEFAULT 0,
  linhas_importadas INTEGER NOT NULL DEFAULT 0,
  linhas_duplicadas INTEGER NOT NULL DEFAULT 0,
  linhas_com_erro INTEGER NOT NULL DEFAULT 0,
  
  -- Status e fase
  status TEXT NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro', 'cancelado')),
  fase TEXT DEFAULT 'iniciando' CHECK (fase IN ('iniciando', 'baixando', 'parsing', 'verificando_duplicatas', 'inserindo', 'finalizando')),
  mensagem_erro TEXT,
  
  -- Resultado para conferência
  resultado_processamento JSONB,
  
  -- Timestamps
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  finalizado_em TIMESTAMP WITH TIME ZONE
);

-- Índices para queries frequentes
CREATE INDEX idx_checklist_import_jobs_empresa_status 
  ON public.checklist_import_jobs(empresa_id, status);

CREATE INDEX idx_checklist_import_jobs_checklist_item 
  ON public.checklist_import_jobs(checklist_item_id);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_checklist_import_jobs_updated_at
  BEFORE UPDATE ON public.checklist_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.checklist_import_jobs ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Users can manage checklist_import_jobs for their empresas"
  ON public.checklist_import_jobs
  FOR ALL
  TO authenticated
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

-- Habilitar Realtime para atualizações em tempo real
ALTER TABLE public.checklist_import_jobs REPLICA IDENTITY FULL;