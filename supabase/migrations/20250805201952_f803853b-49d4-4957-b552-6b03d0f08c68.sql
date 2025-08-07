-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para processar fila de emails automaticamente a cada 2 minutos
SELECT cron.schedule(
  'process-email-queue-auto',
  '*/2 * * * *', -- a cada 2 minutos
  $$
  SELECT
    net.http_post(
        url:='https://fffxxlobeegrzpdtfsgf.supabase.co/functions/v1/process-email-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZnh4bG9iZWVncnpwZHRmc2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MjU4ODQsImV4cCI6MjA2OTMwMTg4NH0.ym4gQFc3n_23aKfWAdgwAxVGcd86FNBFnhXnCDYRz3w"}'::jsonb,
        body:='{"time": "auto"}'::jsonb
    ) as request_id;
  $$
);