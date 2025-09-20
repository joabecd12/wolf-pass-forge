-- Normalize existing participant names to title case
-- This will fix the 73 participants with all-caps names

-- Create a custom function to handle Brazilian name formatting
CREATE OR REPLACE FUNCTION normalize_name(input_name text) 
RETURNS text AS $$
DECLARE
    words text[];
    word text;
    result text := '';
    prepositions text[] := ARRAY['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os', 'para', 'por', 'com', 'sem'];
    i integer := 1;
BEGIN
    -- Convert to lowercase and split into words
    words := string_to_array(lower(trim(input_name)), ' ');
    
    -- Process each word
    FOREACH word IN ARRAY words
    LOOP
        IF word != '' THEN
            -- First word is always capitalized
            IF i = 1 THEN
                word := initcap(word);
            -- Check if it's a preposition (keep lowercase)
            ELSIF word = ANY(prepositions) THEN
                word := lower(word);
            -- Capitalize other words
            ELSE
                word := initcap(word);
            END IF;
            
            -- Add to result
            IF result != '' THEN
                result := result || ' ' || word;
            ELSE
                result := word;
            END IF;
            
            i := i + 1;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all participant names to proper format
UPDATE participants 
SET name = normalize_name(name)
WHERE name ~ '^[A-Z][A-Z ]+$' -- Only update names that are all caps
   OR name != normalize_name(name); -- Or names that aren't properly formatted

-- Clean up the temporary function (optional, but good practice)
-- DROP FUNCTION normalize_name(text);