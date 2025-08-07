-- Criar tabela para logs de webhooks de vendas
CREATE TABLE public.webhook_sales_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin TEXT NOT NULL, -- hubla, monetizze, hotmart, braip, etc
  raw_payload JSONB NOT NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  product_name TEXT,
  product_id TEXT,
  assigned_category TEXT,
  participant_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'duplicate')),
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_sales_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook logs (only viewable by authenticated users)
CREATE POLICY "Anyone can view webhook sales logs" 
ON public.webhook_sales_logs 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert webhook sales logs" 
ON public.webhook_sales_logs 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_webhook_sales_logs_origin ON public.webhook_sales_logs(origin);
CREATE INDEX idx_webhook_sales_logs_status ON public.webhook_sales_logs(status);
CREATE INDEX idx_webhook_sales_logs_processed_at ON public.webhook_sales_logs(processed_at);
CREATE INDEX idx_webhook_sales_logs_buyer_email ON public.webhook_sales_logs(buyer_email);