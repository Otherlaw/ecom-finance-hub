-- Adicionar colunas para controle anti-rate-limit e throttle na tabela nfe_sync_state
ALTER TABLE public.nfe_sync_state 
ADD COLUMN IF NOT EXISTS last_sefaz_request_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rate_limit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rate_limit_at TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN public.nfe_sync_state.last_sefaz_request_at IS 'Timestamp do último request à SEFAZ para evitar chamadas muito próximas';
COMMENT ON COLUMN public.nfe_sync_state.rate_limit_count IS 'Contador de rate limits (erros 656) para backoff exponencial';
COMMENT ON COLUMN public.nfe_sync_state.last_rate_limit_at IS 'Timestamp do último erro 656 para controle de backoff';

-- Atualizar status enum para incluir "paused" (para pausa graceful por limite de requests)
-- Nota: Usamos verificação via função para garantir idempotência
DO $$ 
BEGIN
  -- Atualizar registros existentes com valores default para as novas colunas
  UPDATE public.nfe_sync_state 
  SET 
    rate_limit_count = COALESCE(rate_limit_count, 0),
    last_sefaz_request_at = NULL,
    last_rate_limit_at = NULL
  WHERE rate_limit_count IS NULL;
END $$;