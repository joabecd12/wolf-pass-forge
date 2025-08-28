-- Add audit columns to webhook_sales_logs for sources and amount
ALTER TABLE public.webhook_sales_logs
ADD COLUMN IF NOT EXISTS name_source text,
ADD COLUMN IF NOT EXISTS phone_source text,
ADD COLUMN IF NOT EXISTS amount_cents integer;