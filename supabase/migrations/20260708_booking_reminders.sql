-- ═══════════════════════════════════════════════════════════════════════
-- AUTOMATED BOOKING REMINDERS
--
-- Adds:
--   1. reminder_log — idempotency for the send-booking-reminders Edge
--      Function. Prevents duplicate reminders even if the cron
--      double-fires or the function retries after a timeout.
--   2. appointments_in_window RPC — server-side lookup that returns
--      confirmed appointments in a given time window (used by the
--      Edge Function to find who to remind). Joins shop tier so the
--      function can check the plan gate.
--   3. Cron job that hits the Edge Function every 15 minutes.
--
-- Plan gate (Pro Plan and above): enforced INSIDE the Edge Function
-- rather than here, so we don't need to duplicate the tier logic
-- across the app and this SQL.
--
-- Prerequisites (set once):
--   ALTER DATABASE postgres SET app.reminder_cron_secret = '<secret>';
--   (Same convention as push-fanout — kept in DB settings so the secret
--   can rotate without editing this file.)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  -- Which window this row records: '24h' or '1h'. The two are
  -- independent so a booking gets both if it's still confirmed at
  -- each check.
  kind            text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_appt ON public.reminder_log (appointment_id);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
-- Only service-role writes (via the Edge Function). No end-user policies.
-- If we ever need admin read, add a policy then.


-- ── appointments_in_window RPC ────────────────────────────────────
-- Returns confirmed appointments whose (appointment_date + appointment_time)
-- falls inside [p_start, p_end], along with the enough of the owning
-- shop record for the Edge Function to check the plan gate.
CREATE OR REPLACE FUNCTION public.appointments_in_window(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  id                  uuid,
  shop_id             uuid,
  status              text,
  service_name        text,
  appointment_date    date,
  appointment_time    time,
  customer_name       text,
  customer_phone      text,
  shop_name           text,
  shop_row            jsonb   -- JSON containing subscription + subscription_tier
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      a.id, a.shop_id, a.status, a.service_name,
      a.appointment_date, a.appointment_time,
      a.customer_name, a.customer_phone,
      u.name AS shop_name,
      jsonb_build_object(
        'subscription', u.subscription,
        'subscription_tier', u.subscription_tier
      ) AS shop_row
    FROM public.appointments a
    JOIN public.users u ON u.id = a.shop_id
    WHERE a.status = 'confirmed'
      AND ((a.appointment_date + a.appointment_time)::timestamptz) BETWEEN p_start AND p_end;
END;
$$;


-- ── Cron: fire the Edge Function every 15 minutes ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  fn_url text;
  fn_secret text;
BEGIN
  -- Reuse the same convention: DB-level settings hold the URL and secret
  -- so they can rotate without editing this file. If either is missing
  -- the schedule is skipped (helpful log below).
  BEGIN
    fn_url    := current_setting('app.supabase_url', true) || '/functions/v1/send-booking-reminders';
    fn_secret := current_setting('app.reminder_cron_secret', true);
  EXCEPTION WHEN OTHERS THEN
    fn_url := NULL;
  END;

  IF fn_url IS NULL OR fn_url = '/functions/v1/send-booking-reminders' THEN
    RAISE NOTICE 'Skipping cron schedule — app.supabase_url not set yet. Re-run this migration after ALTER DATABASE SETs land.';
    RETURN;
  END IF;

  -- Unschedule if it already exists (idempotent re-run)
  PERFORM cron.unschedule('send-booking-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-reminders');

  PERFORM cron.schedule(
    'send-booking-reminders',
    '*/15 * * * *',  -- every 15 minutes
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type', 'application/json'
        )
      );
      $cron$,
      fn_url,
      'Bearer ' || COALESCE(fn_secret, '')
    )
  );
END $$;

SELECT 'booking reminders installed — cron runs every 15 min' AS status;
