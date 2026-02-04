-- Habilitar realtime nas tabelas de sincronizacao NF-e
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfe_sync_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfe_sync_logs;