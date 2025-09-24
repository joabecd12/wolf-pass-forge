-- Clean up duplicate emails and add email normalization

-- Step 1: Create a function to normalize emails
CREATE OR REPLACE FUNCTION normalize_email(email_text text)
RETURNS text AS $$
BEGIN
    RETURN LOWER(TRIM(email_text));
END;
$$ LANGUAGE plpgsql;

-- Step 2: Clean up duplicates in participants table
-- For each duplicate email (case insensitive), keep only the most recent record
WITH duplicate_emails AS (
    SELECT 
        LOWER(email) as normalized_email,
        array_agg(id ORDER BY created_at DESC) as participant_ids,
        COUNT(*) as count
    FROM participants 
    GROUP BY LOWER(email) 
    HAVING COUNT(*) > 1
),
records_to_delete AS (
    SELECT 
        unnest(participant_ids[2:]) as id_to_delete
    FROM duplicate_emails
)
DELETE FROM participants 
WHERE id IN (SELECT id_to_delete FROM records_to_delete);

-- Step 3: Clean up orphaned records in email_queue
DELETE FROM email_queue 
WHERE participant_id NOT IN (SELECT id FROM participants);

-- Step 4: Clean up duplicate emails in email_queue for same participant
WITH duplicate_queue_emails AS (
    SELECT 
        participant_id,
        LOWER(email) as normalized_email,
        array_agg(id ORDER BY created_at DESC) as queue_ids,
        COUNT(*) as count
    FROM email_queue 
    GROUP BY participant_id, LOWER(email) 
    HAVING COUNT(*) > 1
),
queue_records_to_delete AS (
    SELECT 
        unnest(queue_ids[2:]) as id_to_delete
    FROM duplicate_queue_emails
)
DELETE FROM email_queue 
WHERE id IN (SELECT id_to_delete FROM queue_records_to_delete);

-- Step 5: Normalize all existing emails to lowercase
UPDATE participants SET email = normalize_email(email);
UPDATE email_queue SET email = normalize_email(email);

-- Step 6: Add unique constraint on email column
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_unique_idx ON participants (email);

-- Step 7: Create trigger to automatically normalize emails on insert/update
CREATE OR REPLACE FUNCTION normalize_participant_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = normalize_email(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_participant_email_trigger
    BEFORE INSERT OR UPDATE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION normalize_participant_email();

-- Step 8: Create trigger for email_queue table as well
CREATE OR REPLACE FUNCTION normalize_email_queue_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = normalize_email(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_email_queue_email_trigger
    BEFORE INSERT OR UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION normalize_email_queue_email();