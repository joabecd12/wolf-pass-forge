
-- Adiciona campos para auditoria dos novos dados do payload v2 da Hubla
ALTER TABLE public.webhook_sales_logs
  ADD COLUMN IF NOT EXISTS offer_id text,
  ADD COLUMN IF NOT EXISTS offer_name_v2 text;
