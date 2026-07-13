-- ═══════════════════════════════════════════════════════════════════════
-- Extend the existing push fanout trigger to ALSO call the new
-- send-native-push function, in the same AFTER INSERT event as the
-- web push fanout. One notification row, two fanout calls — one to
-- every 'web' subscription (existing), one to every 'native' FCM
-- token (new). Both fire-and-forget with their own independent
-- exception handling, so a failure in one can never block the other.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_fanout_webpush() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- ↓↓↓ Replace these if you ever rotate the secret or move projects.
  fn_url        text := 'https://zdertmpzervgjicuwsfz.supabase.co/functions/v1/push-fanout';
  fn_native_url text := 'https://zdertmpzervgjicuwsfz.supabase.co/functions/v1/send-native-push';
  fn_secret     text := 'qwertyuiopasdfghjklzxcvbnm';
BEGIN
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
    RAISE WARNING 'web push fanout failed for notification %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    PERFORM net.http_post(
      url := fn_native_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(fn_secret, '')
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'native push fanout failed for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

SELECT 'push fanout now calls both web and native push senders for every notification' AS status;
