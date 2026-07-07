-- ═══════════════════════════════════════════════════════════════════════
-- WEB PUSH FANOUT TRIGGER
--
-- When a row lands in public.notifications, call the push-fanout Edge
-- Function via pg_net (async HTTP), which sends Web Push messages to
-- every device subscribed for that user.
--
-- Runs AFTER the notification is committed, so:
--   - If the notification insert is rolled back, no push fires (single
--     source of truth: the notifications table).
--   - The push send is async — real business events (order INSERT,
--     appointment INSERT) don't wait on HTTP.
--
-- Requires Supabase Dashboard secrets set:
--   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--   PUSH_FANOUT_SECRET  (any random string, shared with pg_net headers)
--
-- And these Postgres settings must be set once via SQL Editor:
--   app.supabase_url          — your project's URL
--   app.push_fanout_secret    — the same secret set as an edge secret
-- We store them in the database rather than embedding in the trigger
-- source so the secret can be rotated without editing this file.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: read the fanout URL from database settings. Falls back to a
-- constant so the function still parses even before settings are set;
-- the trigger just no-ops if the URL doesn't look valid.
CREATE OR REPLACE FUNCTION public.notify_fanout_webpush() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text;
  fn_secret text;
BEGIN
  -- Read from database-level settings. Set once via:
  --   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
  --   ALTER DATABASE postgres SET app.push_fanout_secret = '<same as edge secret>';
  BEGIN
    fn_url    := current_setting('app.supabase_url', true) || '/functions/v1/push-fanout';
    fn_secret := current_setting('app.push_fanout_secret', true);
  EXCEPTION WHEN OTHERS THEN
    fn_url := NULL;
  END;

  -- If settings aren't wired up yet, skip silently. In-app delivery
  -- (via Supabase Realtime on notifications) still works — this only
  -- covers the "browser tab closed" case.
  IF fn_url IS NULL OR fn_url = '/functions/v1/push-fanout' THEN
    RETURN NEW;
  END IF;

  -- Fire and forget. Never let a push failure abort the notification
  -- insert (which was itself already inside another triggering event).
  BEGIN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(fn_secret, '')
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push fanout failed for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_push_fanout ON public.notifications;
CREATE TRIGGER notification_push_fanout
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_fanout_webpush();

SELECT 'push fanout trigger installed — remember to set app.supabase_url and app.push_fanout_secret' AS status;
