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
-- The URL and secret used to REACH the edge function are embedded
-- directly below (SUPABASE_PROJECT_URL, PUSH_FANOUT_SECRET_VALUE) —
-- NOT read from database-level settings via current_setting(). The
-- original version of this migration used
-- ALTER DATABASE postgres SET app.supabase_url = ...
-- but Supabase's hosted Postgres does not grant the dashboard's
-- postgres role permission to run ALTER DATABASE SET for custom
-- parameters (a platform restriction, not a mistake in how it was run)
-- — ERROR 42501: permission denied to set parameter. Embedding the
-- values directly in this SECURITY DEFINER function body sidesteps
-- that restriction entirely. The project URL is not secret (it's the
-- same URL the app's own client code already calls); the function
-- source itself is only visible to someone with schema-inspection SQL
-- access — the same trust level ALTER DATABASE would have required
-- anyway.
--
-- To rotate the secret later: update PUSH_FANOUT_SECRET in Supabase
-- Edge Function secrets AND re-run this file with the new value
-- substituted below — the two have to match.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_fanout_webpush() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- ↓↓↓ Replace these two if you ever rotate the secret or move projects.
  fn_url    text := 'https://zdertmpzervgjicuwsfz.supabase.co/functions/v1/push-fanout';
  fn_secret text := 'qwertyuiopasdfghjklzxcvbnm';
BEGIN
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

SELECT 'push fanout trigger installed — URL and secret embedded directly, no ALTER DATABASE needed' AS status;
