-- Reagendar cron para 1x/dia às 00:00 BRT (03:00 UTC)
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

-- Limpar next_retry_at de estados antigos com retry no meio do dia
-- Setar para próxima 00:00 BRT (03:00 UTC)
UPDATE nfe_sync_state
SET next_retry_at = (
  CASE 
    WHEN (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo' > now()
    THEN (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo'
    ELSE (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '2 days') AT TIME ZONE 'America/Sao_Paulo'
  END
),
status = CASE WHEN status = 'error' AND next_retry_at IS NOT NULL THEN 'rate_limited' ELSE status END
WHERE next_retry_at IS NOT NULL 
  AND next_retry_at > now();