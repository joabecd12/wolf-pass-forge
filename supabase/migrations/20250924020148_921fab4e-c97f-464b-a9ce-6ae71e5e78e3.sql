-- Fix all participant names that are in ALL CAPS to proper title case
-- This will normalize the 54 participants identified with formatting issues

-- First, let's create a function to convert names to title case with Brazilian prepositions
CREATE OR REPLACE FUNCTION normalize_participant_name(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
    words TEXT[];
    word TEXT;
    result TEXT := '';
    prepositions TEXT[] := ARRAY['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os', 'para', 'por', 'com', 'sem'];
    i INTEGER := 1;
BEGIN
    -- Return empty if input is null or empty
    IF input_name IS NULL OR LENGTH(TRIM(input_name)) = 0 THEN
        RETURN input_name;
    END IF;
    
    -- Split the name into words
    words := string_to_array(LOWER(TRIM(input_name)), ' ');
    
    -- Process each word
    FOREACH word IN ARRAY words
    LOOP
        IF LENGTH(word) > 0 THEN
            -- First word is always capitalized
            IF i = 1 THEN
                word := INITCAP(word);
            -- Check if it's a preposition (should stay lowercase)
            ELSIF word = ANY(prepositions) THEN
                word := LOWER(word);
            -- Other words are capitalized
            ELSE
                word := INITCAP(word);
            END IF;
            
            -- Add to result
            IF result = '' THEN
                result := word;
            ELSE
                result := result || ' ' || word;
            END IF;
        END IF;
        i := i + 1;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all participant names that are in ALL CAPS or have formatting issues
UPDATE participants 
SET name = normalize_participant_name(name)
WHERE 
    -- Names that are all uppercase (problematic case)
    name = UPPER(name) 
    AND name != LOWER(name)
    AND LENGTH(name) > 1;

-- Clean up the function after migration
DROP FUNCTION normalize_participant_name(TEXT);