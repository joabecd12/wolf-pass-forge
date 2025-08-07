-- Add unique constraint to prevent duplicate emails
ALTER TABLE public.participants 
ADD CONSTRAINT participants_email_unique UNIQUE (email);