-- Tabela para acompanhar jobs de importação de marketplace
CREATE TABLE public.marketplace_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  canal TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  linhas_processadas INTEGER NOT NULL DEFAULT 0,
  linhas_importadas INTEGER NOT NULL DEFAULT 0,
  linhas_duplicadas INTEGER NOT NULL DEFAULT 0,
  linhas_com_erro INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando',
  mensagem_erro TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMP WITH TIME ZONE
);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_marketplace_import_jobs_updated_at
  BEFORE UPDATE ON public.marketplace_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.marketplace_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies (padrão público como outras tabelas)
CREATE POLICY "Allow public read marketplace_import_jobs"
  ON public.marketplace_import_jobs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert marketplace_import_jobs"
  ON public.marketplace_import_jobs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update marketplace_import_jobs"
  ON public.marketplace_import_jobs
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete marketplace_import_jobs"
  ON public.marketplace_import_jobs
  FOR DELETE
  USING (true);

-- Index para queries frequentes
CREATE INDEX idx_marketplace_import_jobs_empresa_status 
  ON public.marketplace_import_jobs(empresa_id, status);

CREATE INDEX idx_marketplace_import_jobs_criado_em 
  ON public.marketplace_import_jobs(criado_em DESC);