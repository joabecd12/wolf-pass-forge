-- Enable RLS on wolf_sales table (the remaining table without RLS)
ALTER TABLE wolf_sales ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for wolf_sales (only authenticated users can access)
CREATE POLICY "Authenticated can view wolf_sales" ON wolf_sales
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert wolf_sales" ON wolf_sales
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fix the remaining function search path issue
CREATE OR REPLACE FUNCTION public.set_short_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.short_id := UPPER(LEFT(NEW.id::text, 8));
  RETURN NEW;
END;
$$;