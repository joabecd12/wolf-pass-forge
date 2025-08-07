-- Add presencas column to participants table to track presence by day
ALTER TABLE public.participants 
ADD COLUMN presencas JSONB DEFAULT '{}';

-- Add index for better performance on presencas queries
CREATE INDEX idx_participants_presencas ON public.participants USING GIN(presencas);

-- Update existing participants to have empty presencas object
UPDATE public.participants SET presencas = '{}' WHERE presencas IS NULL;