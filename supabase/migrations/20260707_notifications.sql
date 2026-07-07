-- ═══════════════════════════════════════════════════════════════════════
-- IN-APP + WEB PUSH NOTIFICATIONS
--
-- Two tables:
--
--  1. public.notifications  — the "inbox" per user. Every notification
--     the app ever wants to show a user (shop / customer / distributor
--     / admin) gets a row here. Read state is tracked so the bell icon
--     can show an unread count.
--
--  2. public.push_subscriptions — Web Push endpoints (VAPID) that the
--     Edge Function fans notifications out to. One user can have many
--     endpoints (desktop Chrome, phone Chrome, etc.). Endpoint URL is
--     unique so re-subscribing just upserts.
--
-- RLS: a user can only see / mutate their OWN notifications and
-- subscriptions. Admins can see everything.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Category drives icon + color in the notification center. See
  -- src/lib/notificationTypes.js for the canonical set.
  category    text NOT NULL DEFAULT 'info',
  -- Rendered title + body. Kept as plain text; the UI knows how to
  -- format each category (e.g. 'order' shows an order icon).
  title       text NOT NULL,
  body        text,
  -- Deep-link the user should be navigated to when they tap the
  -- notification. Relative path, e.g. '/shop?tab=bills&order=abc'.
  action_url  text,
  -- Optional payload for the client to render extras (order amount,
  -- customer name). JSONB so it's queryable but flexible.
  data        jsonb DEFAULT '{}'::jsonb,
  read        boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
CREATE POLICY "notif_own_select" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
CREATE POLICY "notif_own_update" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
    OR user_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "notif_own_delete" ON public.notifications;
CREATE POLICY "notif_own_delete" ON public.notifications
  FOR DELETE USING (
    user_id = auth.uid()
    OR user_id = public.current_profile_id()
  );

-- Only triggers / edge functions insert notifications (service-role bypass).
-- No end-user INSERT policy — prevents a compromised client from spamming
-- another user's inbox.


-- ── Web Push subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  keys_p256dh  text NOT NULL,
  keys_auth    text NOT NULL,
  -- Which client this subscription belongs to — 'web' (browser) or
  -- 'native' (Capacitor push token). We're only using 'web' now but
  -- the column reserves the shape for adding native later without a
  -- migration.
  client       text NOT NULL DEFAULT 'web',
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_own_select" ON public.push_subscriptions;
CREATE POLICY "push_own_select" ON public.push_subscriptions
  FOR SELECT USING (
    user_id = auth.uid() OR user_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "push_own_insert" ON public.push_subscriptions;
CREATE POLICY "push_own_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR user_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "push_own_delete" ON public.push_subscriptions;
CREATE POLICY "push_own_delete" ON public.push_subscriptions
  FOR DELETE USING (
    user_id = auth.uid() OR user_id = public.current_profile_id()
  );


-- ── Enable Realtime on notifications ─────────────────────────────────
-- The client subscribes to postgres_changes on this table filtered by
-- user_id, so new notifications appear instantly in the bell drawer
-- and can pop as toasts without a page refresh.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

SELECT 'notifications + push_subscriptions ready' AS status;
