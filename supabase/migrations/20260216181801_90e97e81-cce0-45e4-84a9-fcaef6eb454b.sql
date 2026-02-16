-- Atualizar cron para rodar 1x/dia às 03:00 UTC (00:00 BRT)
SELECT cron.unschedule('nfe-sync-auto');

SELECT cron.schedule(
  'nfe-sync-auto',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://bwfbozwyqujlykgaueez.supabase.co/functions/v1/nfe-sync-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);