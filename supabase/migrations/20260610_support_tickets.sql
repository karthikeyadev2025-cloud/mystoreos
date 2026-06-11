-- ============================================================
-- Support ticket system (replaces phone support)
-- Users raise tickets; admins view + reply. Threaded messages.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT,                       -- snapshot (for guests / display)
  role TEXT,                       -- shop / distributor / customer / ca / guest
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- billing / technical / account / general
  status TEXT DEFAULT 'open',      -- open / pending / resolved / closed
  priority TEXT DEFAULT 'normal',  -- low / normal / high
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,            -- 'user' | 'admin' | 'bot'
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON public.support_messages(ticket_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: owner or admin can read; owner can create; owner or admin update
DROP POLICY IF EXISTS tickets_read ON public.support_tickets;
CREATE POLICY tickets_read ON public.support_tickets FOR SELECT USING (
  user_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);
DROP POLICY IF EXISTS tickets_insert ON public.support_tickets;
CREATE POLICY tickets_insert ON public.support_tickets FOR INSERT WITH CHECK (
  user_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);
DROP POLICY IF EXISTS tickets_update ON public.support_tickets;
CREATE POLICY tickets_update ON public.support_tickets FOR UPDATE USING (
  user_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);

-- Messages: readable/insertable by the ticket owner or admin
DROP POLICY IF EXISTS messages_read ON public.support_messages;
CREATE POLICY messages_read ON public.support_messages FOR SELECT USING (
  public.current_user_role() = 'admin' OR ticket_id IN (
    SELECT id FROM public.support_tickets WHERE user_id = public.current_profile_id()
  )
);
DROP POLICY IF EXISTS messages_insert ON public.support_messages;
CREATE POLICY messages_insert ON public.support_messages FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' OR ticket_id IN (
    SELECT id FROM public.support_tickets WHERE user_id = public.current_profile_id()
  )
);

SELECT 'support_tickets + support_messages ready' AS status;
