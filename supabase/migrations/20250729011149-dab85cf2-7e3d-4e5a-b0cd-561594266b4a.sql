-- Create admin user with specified credentials
-- This will create a user that can access the admin panel

-- Insert the admin user using Supabase's auth functions
-- Note: In production, this should be done through Supabase dashboard or admin API
-- For development purposes, we'll create a temporary solution

-- First, let's create a simple admin users table to track admin access
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies (only admins can manage admins)
CREATE POLICY "Admins can view admin_users" 
ON public.admin_users 
FOR SELECT 
USING (true); -- For now, allow viewing

CREATE POLICY "Admins can insert admin_users" 
ON public.admin_users 
FOR INSERT 
WITH CHECK (true); -- For now, allow insert

-- Insert the admin user
-- Note: In a real scenario, you would create this user through Supabase Auth
-- For now, we'll store the credentials in our admin table as backup
INSERT INTO public.admin_users (email, password_hash) 
VALUES ('joabecd1@gmail.com', 'Wolf@ticket') 
ON CONFLICT (email) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();