-- ═══════════════════════════════════════════════════════════════════════
-- HOME SERVICE SAFETY FEATURES
--
-- Built specifically for the real risk home-visit services carry —
-- staff (often women, for beauty services specifically) going alone to
-- a stranger's address. Three real, concrete pieces:
--
-- 1. PRECISE LOCATION for the visit address — a typed address can be
--    vague, wrong, or incomplete. Capturing real GPS coordinates
--    alongside it (customer opts in, at booking time) means staff can
--    actually navigate straight there, and there's a verifiable record
--    of exactly where the visit was meant to happen.
--
-- 2. STAFF CHECK-IN — when the assigned staff member marks 'on my way'
--    or 'arrived', their own live location is captured at that moment.
--    Not continuous tracking (that's a much bigger, more invasive
--    feature this app doesn't need) — a timestamped snapshot at the
--    two moments that matter: leaving, and arriving.
--
-- 3. EMERGENCY SOS — a single, unmistakable action available during an
--    active home visit. Captures the staff member's current location
--    and fires the HIGHEST priority notification this app can send —
--    push notification with requireInteraction (stays in the OS tray
--    until acted on, not a toast that vanishes), plus a maps link
--    straight to their exact position.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.appointments
  -- Precise address location — optional, customer opts in at booking.
  ADD COLUMN IF NOT EXISTS customer_lat double precision,
  ADD COLUMN IF NOT EXISTS customer_lng double precision,
  -- Staff safety check-in — captured at 'on my way' and 'arrived'.
  ADD COLUMN IF NOT EXISTS staff_enroute_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_enroute_lat double precision,
  ADD COLUMN IF NOT EXISTS staff_enroute_lng double precision,
  ADD COLUMN IF NOT EXISTS staff_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_arrived_lat double precision,
  ADD COLUMN IF NOT EXISTS staff_arrived_lng double precision,
  -- Emergency SOS — the real safety feature.
  ADD COLUMN IF NOT EXISTS sos_triggered_at timestamptz,
  ADD COLUMN IF NOT EXISTS sos_lat double precision,
  ADD COLUMN IF NOT EXISTS sos_lng double precision,
  ADD COLUMN IF NOT EXISTS sos_triggered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sos_acknowledged_at timestamptz;

-- ── SOS notification — the one that has to actually work every time ──
CREATE OR REPLACE FUNCTION public.notify_sos_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_maps_url text;
  v_staff_name text;
BEGIN
  IF (TG_OP = 'UPDATE') AND OLD.sos_triggered_at IS NULL AND NEW.sos_triggered_at IS NOT NULL THEN
    v_maps_url := CASE WHEN NEW.sos_lat IS NOT NULL AND NEW.sos_lng IS NOT NULL
      THEN 'https://maps.google.com/?q=' || NEW.sos_lat::text || ',' || NEW.sos_lng::text
      ELSE NULL END;

    SELECT name INTO v_staff_name FROM public.users WHERE id = NEW.sos_triggered_by;

    -- requireInteraction: true is set client-side by the push service
    -- worker for anything category='sos' — the notification stays in
    -- the OS tray, doesn't auto-dismiss, until the shop owner actually
    -- taps it. This is the one alert in the whole app that's allowed
    -- to be persistent/intrusive on purpose.
    PERFORM public.push_notification(
      NEW.shop_id, 'sos',
      '🆘 EMERGENCY — ' || COALESCE(v_staff_name, 'Staff member') || ' needs help',
      COALESCE(NEW.customer_name, 'Customer') || ' · ' || to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM')
        || CASE WHEN v_maps_url IS NOT NULL THEN ' · ' || v_maps_url ELSE ' · Location unavailable' END,
      '/shop?tab=bookings&appointment=' || NEW.id::text || '&sos=1',
      jsonb_build_object('appointment_id', NEW.id, 'sos_lat', NEW.sos_lat, 'sos_lng', NEW.sos_lng, 'maps_url', v_maps_url)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_sos ON public.appointments;
CREATE TRIGGER notify_sos
  AFTER UPDATE OF sos_triggered_at ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_sos_events();

-- ── Overdue check-in — the safety net for when nothing gets tapped ──
-- If a home-visit appointment's scheduled time has passed by more than
-- 45 minutes and staff never checked in as arrived, this is exactly
-- the "went quiet, nobody noticed" scenario safety features exist to
-- prevent. Checked by a scheduled query, not a trigger, since this is
-- about the ABSENCE of an event over time, not a specific row change.
CREATE OR REPLACE FUNCTION public.check_overdue_home_visits() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM public.appointments
    WHERE service_location = 'at_home'
      AND status = 'confirmed'
      AND staff_arrived_at IS NULL
      AND sos_triggered_at IS NULL
      AND (appointment_date + appointment_time + interval '45 minutes') < now()
      AND (appointment_date + appointment_time + interval '3 hours') > now() -- don't re-alert forever on very old rows
  LOOP
    -- Idempotent: only notify once per appointment by checking if we
    -- already sent this exact overdue alert (reuse the notifications
    -- table itself as the dedupe check rather than adding a new column).
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE (data->>'appointment_id')::uuid = r.id AND category = 'overdue_checkin'
    ) THEN
      PERFORM public.push_notification(
        r.shop_id, 'overdue_checkin',
        '⚠️ No check-in yet — ' || COALESCE(r.customer_name, 'Customer'),
        'Home visit was due ' || to_char(r.appointment_time, 'HH12:MI AM') || ' — staff hasn''t checked in as arrived. Worth a call.',
        '/shop?tab=bookings&appointment=' || r.id::text,
        jsonb_build_object('appointment_id', r.id)
      );
    END IF;
  END LOOP;
END;
$$;

SELECT 'home service safety features installed — precise location, staff check-in, SOS, overdue-check-in safety net' AS status;
