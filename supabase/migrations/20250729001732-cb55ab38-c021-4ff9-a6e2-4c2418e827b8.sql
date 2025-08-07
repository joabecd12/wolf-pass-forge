-- Add codigo field to participants table
ALTER TABLE public.participants 
ADD COLUMN codigo TEXT UNIQUE;

-- Update existing participant with the code from the example
UPDATE public.participants 
SET codigo = '1D3EAE35'
WHERE id = '1d3eae35-5378-4af0-b8ce-1044f37dd050';

-- Create index for better performance on codigo searches
CREATE INDEX idx_participants_codigo ON public.participants(codigo);