-- Tighten RLS across core tables and restrict admin_users
-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive existing policies
DROP POLICY IF EXISTS "Anyone can create participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can delete participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can view participants" ON public.participants;

DROP POLICY IF EXISTS "Anyone can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can view tickets" ON public.tickets;

DROP POLICY IF EXISTS "Anyone can create validations" ON public.validations;
DROP POLICY IF EXISTS "Anyone can view validations" ON public.validations;

DROP POLICY IF EXISTS "Anyone can create email queue entries" ON public.email_queue;
DROP POLICY IF EXISTS "Anyone can update email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Anyone can view email queue" ON public.email_queue;

DROP POLICY IF EXISTS "Anyone can view webhook sales logs" ON public.webhook_sales_logs;
DROP POLICY IF EXISTS "System can insert webhook sales logs" ON public.webhook_sales_logs;

DROP POLICY IF EXISTS "Admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;

-- Create safer policies
-- participants: allow full CRUD to authenticated users
CREATE POLICY "Authenticated can select participants"
ON public.participants
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert participants"
ON public.participants
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update participants"
ON public.participants
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete participants"
ON public.participants
FOR DELETE
USING (auth.role() = 'authenticated');

-- tickets: allow full CRUD to authenticated users
CREATE POLICY "Authenticated can select tickets"
ON public.tickets
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert tickets"
ON public.tickets
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update tickets"
ON public.tickets
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete tickets"
ON public.tickets
FOR DELETE
USING (auth.role() = 'authenticated');

-- validations: allow viewing and inserting by authenticated users
CREATE POLICY "Authenticated can select validations"
ON public.validations
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert validations"
ON public.validations
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- email_queue: allow only viewing by authenticated users (mutations via service role edge function)
CREATE POLICY "Authenticated can select email_queue"
ON public.email_queue
FOR SELECT
USING (auth.role() = 'authenticated');

-- webhook_sales_logs: allow only viewing by authenticated users (insertion via service role edge function)
CREATE POLICY "Authenticated can select webhook_sales_logs"
ON public.webhook_sales_logs
FOR SELECT
USING (auth.role() = 'authenticated');

-- admin_users: no policies created => RLS enabled denies all access by default
-- This table is considered deprecated/unsafe; keeping it inaccessible.
