-- Add validated_by_user_id column to validations table for better security tracking
ALTER TABLE public.validations 
ADD COLUMN validated_by_user_id UUID REFERENCES auth.users(id);

-- Add index for better performance on queries by user
CREATE INDEX idx_validations_validated_by_user_id ON public.validations(validated_by_user_id);