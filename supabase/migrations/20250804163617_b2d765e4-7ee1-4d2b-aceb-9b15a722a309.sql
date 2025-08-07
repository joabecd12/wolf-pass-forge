-- Add short_id column to participants table
ALTER TABLE participants ADD COLUMN short_id TEXT;

-- Populate existing records with short_id (first 8 characters of UUID in uppercase)
UPDATE participants SET short_id = UPPER(LEFT(id::text, 8));

-- Create function to automatically set short_id for new records
CREATE OR REPLACE FUNCTION set_short_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.short_id := UPPER(LEFT(NEW.id::text, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set short_id before insert
CREATE TRIGGER trg_set_short_id
BEFORE INSERT ON participants
FOR EACH ROW
EXECUTE FUNCTION set_short_id();