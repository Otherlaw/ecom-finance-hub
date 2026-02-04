-- Adicionar campo next_retry_at na tabela nfe_sync_state para controle de rate limiting
ALTER TABLE public.nfe_sync_state 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Adicionar novo status 'rate_limited' se a coluna status for do tipo text
-- Como status é TEXT, podemos usar qualquer valor
COMMENT ON COLUMN public.nfe_sync_state.next_retry_at IS 'Data/hora após a qual a sincronização pode ser tentada novamente (usado para rate limit SEFAZ 656)';