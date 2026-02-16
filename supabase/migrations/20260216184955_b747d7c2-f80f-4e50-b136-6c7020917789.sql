
-- Add bootstrap tracking fields to nfe_sync_state
ALTER TABLE public.nfe_sync_state 
  ADD COLUMN IF NOT EXISTS bootstrap_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'bootstrap';

-- Comment for clarity
COMMENT ON COLUMN public.nfe_sync_state.bootstrap_completed_at IS 'Timestamp when bootstrap (initial 30-day import) was completed';
COMMENT ON COLUMN public.nfe_sync_state.sync_mode IS 'Current sync mode: bootstrap (first 30 days) or daily (last 24h)';

-- For companies that already have last_sync_at (i.e., have synced before), mark bootstrap as completed
UPDATE public.nfe_sync_state 
SET bootstrap_completed_at = last_sync_at, sync_mode = 'daily'
WHERE last_sync_at IS NOT NULL;

-- Cleanup: reset any next_retry_at that points to mid-day (legacy backoff)
UPDATE public.nfe_sync_state
SET next_retry_at = NULL
WHERE next_retry_at IS NOT NULL 
  AND status IN ('rate_limited', 'error', 'idle')
  AND next_retry_at < now();

-- Ensure unique constraint on nfe_documents (empresa_id, access_key) exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'nfe_documents' 
    AND indexname = 'nfe_documents_empresa_access_key_unique'
  ) THEN
    CREATE UNIQUE INDEX nfe_documents_empresa_access_key_unique 
    ON public.nfe_documents (empresa_id, access_key);
  END IF;
END $$;

-- Reschedule cron to 00:00 BRT (03:00 UTC) daily
SELECT cron.unschedule('nfe-sync-auto');
SELECT cron.schedule(
  'nfe-sync-auto',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bwfbozwyqujlykgaueez.supabase.co/functions/v1/nfe-sync-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
