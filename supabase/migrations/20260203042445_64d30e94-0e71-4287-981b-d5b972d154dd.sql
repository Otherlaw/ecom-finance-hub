-- Habilitar extensões necessárias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar sincronização automática de NF-e a cada 6 horas
SELECT cron.schedule(
  'nfe-sync-auto',
  '0 */6 * * *', -- a cada 6 horas (00:00, 06:00, 12:00, 18:00)
  $$
  SELECT
    net.http_post(
      url := 'https://bwfbozwyqujlykgaueez.supabase.co/functions/v1/nfe-sync-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);