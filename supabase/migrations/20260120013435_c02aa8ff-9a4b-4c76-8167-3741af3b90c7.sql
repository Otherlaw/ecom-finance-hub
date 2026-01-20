-- Adicionar campo hash_arquivo para detecção de duplicidade de arquivos
ALTER TABLE public.checklist_canal_arquivos 
ADD COLUMN IF NOT EXISTS hash_arquivo TEXT;

-- Índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_checklist_arquivos_hash 
ON public.checklist_canal_arquivos(hash_arquivo);

-- Adicionar campo para CNPJ extraído do arquivo (validação de empresa)
ALTER TABLE public.checklist_canal_arquivos 
ADD COLUMN IF NOT EXISTS cnpj_arquivo TEXT;

-- Adicionar campo para período detectado no arquivo
ALTER TABLE public.checklist_canal_arquivos 
ADD COLUMN IF NOT EXISTS periodo_detectado JSONB;

-- Comentários para documentação
COMMENT ON COLUMN public.checklist_canal_arquivos.hash_arquivo IS 'Hash SHA-256 do conteúdo do arquivo para detecção de duplicidade';
COMMENT ON COLUMN public.checklist_canal_arquivos.cnpj_arquivo IS 'CNPJ extraído do arquivo para validação de empresa';
COMMENT ON COLUMN public.checklist_canal_arquivos.periodo_detectado IS 'Período de dados detectado no arquivo (data_inicio, data_fim)';