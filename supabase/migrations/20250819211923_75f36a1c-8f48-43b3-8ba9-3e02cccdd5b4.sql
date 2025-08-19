
-- Garantir RLS habilitado (caso ainda não esteja)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Permitir INSERT para usuários autenticados (necessário para agendar emails via app)
CREATE POLICY "Authenticated can insert email_queue"
  ON public.email_queue
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Permitir UPDATE para usuários autenticados (necessário para reagendar/atualizar via app)
CREATE POLICY "Authenticated can update email_queue"
  ON public.email_queue
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
