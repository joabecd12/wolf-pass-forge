-- Add DELETE policies for participants table
CREATE POLICY "Anyone can delete participants" 
ON public.participants 
FOR DELETE 
USING (true);

-- Add DELETE policies for tickets table
CREATE POLICY "Anyone can delete tickets" 
ON public.tickets 
FOR DELETE 
USING (true);