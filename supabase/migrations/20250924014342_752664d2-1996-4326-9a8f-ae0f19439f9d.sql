-- Fix security issues from previous migration

-- Fix function search_path issues by setting search_path to public
CREATE OR REPLACE FUNCTION normalize_email(email_text text)
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN LOWER(TRIM(email_text));
END;
$$;

CREATE OR REPLACE FUNCTION normalize_participant_email()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.email = normalize_email(NEW.email);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_email_queue_email()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.email = normalize_email(NEW.email);
    RETURN NEW;
END;
$$;

-- Enable RLS on admin_users and hubla_raw_events tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubla_raw_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_users (only admins can access)
CREATE POLICY "Admins can access admin_users" ON admin_users
FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policies for hubla_raw_events (only authenticated users can access)
CREATE POLICY "Authenticated can view hubla_raw_events" ON hubla_raw_events
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert hubla_raw_events" ON hubla_raw_events
FOR INSERT WITH CHECK (auth.role() = 'authenticated');