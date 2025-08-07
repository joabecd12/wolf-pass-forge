-- Create enum for ticket categories
CREATE TYPE public.ticket_category AS ENUM ('Wolf Gold', 'Wolf Black', 'VIP Wolf');

-- Create participants table (leads)
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  category ticket_category NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL UNIQUE,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create validations table for tracking scans
CREATE TABLE public.validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  validated_by TEXT,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Enable Row Level Security
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an event management system)
-- Participants policies
CREATE POLICY "Anyone can view participants" 
ON public.participants 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create participants" 
ON public.participants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update participants" 
ON public.participants 
FOR UPDATE 
USING (true);

-- Tickets policies
CREATE POLICY "Anyone can view tickets" 
ON public.tickets 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create tickets" 
ON public.tickets 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update tickets" 
ON public.tickets 
FOR UPDATE 
USING (true);

-- Validations policies
CREATE POLICY "Anyone can view validations" 
ON public.validations 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create validations" 
ON public.validations 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_participants_email ON public.participants(email);
CREATE INDEX idx_participants_category ON public.participants(category);
CREATE INDEX idx_tickets_participant_id ON public.tickets(participant_id);
CREATE INDEX idx_tickets_qr_code ON public.tickets(qr_code);
CREATE INDEX idx_tickets_is_validated ON public.tickets(is_validated);
CREATE INDEX idx_validations_ticket_id ON public.validations(ticket_id);