-- Create email queue table for bulk email management
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for email queue
CREATE POLICY "Anyone can view email queue" 
ON public.email_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create email queue entries" 
ON public.email_queue 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update email queue" 
ON public.email_queue 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_email_queue_updated_at
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queue processing
CREATE INDEX idx_email_queue_status_scheduled ON public.email_queue(status, scheduled_at);
CREATE INDEX idx_email_queue_participant ON public.email_queue(participant_id);