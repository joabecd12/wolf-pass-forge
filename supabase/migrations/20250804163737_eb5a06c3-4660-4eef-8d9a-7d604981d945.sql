-- Fix security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION set_short_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.short_id := UPPER(LEFT(NEW.id::text, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';