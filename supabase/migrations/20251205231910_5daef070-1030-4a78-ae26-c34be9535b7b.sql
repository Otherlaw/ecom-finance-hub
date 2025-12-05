-- Tabela para rastrear jobs de importação de produtos
CREATE TABLE IF NOT EXISTS public.produto_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  arquivo_nome TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  linhas_processadas INTEGER NOT NULL DEFAULT 0,
  linhas_importadas INTEGER NOT NULL DEFAULT 0,
  linhas_atualizadas INTEGER NOT NULL DEFAULT 0,
  linhas_com_erro INTEGER NOT NULL DEFAULT 0,
  mapeamentos_criados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro')),
  mensagem_erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_produto_import_jobs_empresa_id ON public.produto_import_jobs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_import_jobs_status ON public.produto_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_produto_import_jobs_criado_em ON public.produto_import_jobs(criado_em DESC);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION public.set_produto_import_jobs_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_produto_import_jobs_atualizado_em
  BEFORE UPDATE ON public.produto_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_produto_import_jobs_atualizado_em();

-- Habilitar RLS
ALTER TABLE public.produto_import_jobs ENABLE ROW LEVEL SECURITY;

-- Política pública para desenvolvimento
CREATE POLICY "Permitir acesso público a produto_import_jobs" 
  ON public.produto_import_jobs 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.produto_import_jobs;