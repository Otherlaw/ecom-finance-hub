-- Habilitar Realtime para a tabela marketplace_import_jobs
-- Isso permite que o frontend receba atualizações em tempo real do progresso

-- Configurar REPLICA IDENTITY para capturar dados completos nas alterações
ALTER TABLE public.marketplace_import_jobs REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_import_jobs;