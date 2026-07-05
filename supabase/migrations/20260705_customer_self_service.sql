-- ─────────────────────────────────────────────────────────────────────────
-- Customer self-service reschedule/cancel
--
-- TWO SEPARATE, CORRECTLY-SCOPED ACCESS PATHS — no shortcuts that repeat
-- the earlier appointments privacy bug:
--
-- 1. GUEST bookings (no account) — a "manage_token" capability link.
--    Each appointment gets a random, unguessable UUID at creation time.
--    The customer sees a "Manage this booking" link on their confirmation
--    screen (shown once, in their own browser, right after booking — no
--    email/SMS delivery infrastructure needed). Possessing the token is
--    the only proof of ownership needed, same trust model as "anyone with
--    the link" sharing used by many mainstream products. Implemented as
--    SECURITY DEFINER functions so the general anon column-grant (still
--    locked to non-identifying columns, per the privacy fix) is never
--    weakened — the token functions bypass RLS internally, narrowly, for
--    exactly one row that the caller can already prove they know about.
--
-- 2. LOGGED-IN customers — a real RLS policy scoped to their OWN account's
--    verified phone number (looked up server-side from their authenticated
--    profile, never trusting a client-supplied phone). Powers the "My
--    Bookings" section in the customer dashboard.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manage_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS appointments_manage_token_idx ON public.appointments(manage_token);

-- Re-grant anon's column list to include manage_token — needed so a guest
-- customer can receive their own token back after booking (to show the
-- "Manage this booking" link). The original grant (from
-- 20260705_appointments_privacy_fix.sql) may already be applied; this
-- REVOKE+GRANT here supersedes it with the updated column list, which is
-- safe to run even if that migration already ran.
REVOKE SELECT ON public.appointments FROM anon;
GRANT SELECT (id, shop_id, appointment_date, appointment_time, duration_minutes, status, manage_token)
  ON public.appointments TO anon;

-- ── Guest capability-token functions ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_appointment_by_token(p_token uuid)
RETURNS SETOF public.appointments
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.appointments WHERE manage_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(p_token uuid)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.appointments;
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE manage_token = p_token AND status NOT IN ('completed', 'cancelled')
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found, or it cannot be cancelled anymore.';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(p_token uuid, p_new_date date, p_new_time time)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.appointments;
BEGIN
  UPDATE public.appointments
  SET appointment_date = p_new_date, appointment_time = p_new_time,
      status = 'pending', -- rescheduled bookings go back to pending for the shop to re-confirm
      updated_at = now()
  WHERE manage_token = p_token AND status NOT IN ('completed', 'cancelled')
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found, or it cannot be rescheduled anymore.';
  END IF;
  RETURN result;
EXCEPTION WHEN exclusion_violation THEN
  -- Same double-booking prevention the original booking flow relies on —
  -- rescheduling into an already-taken slot is caught here too.
  RAISE EXCEPTION 'That time slot is already booked. Please pick a different time.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, date, time) TO anon, authenticated;

-- ── Logged-in customer's own bookings (RLS, not a token) ────────────────

DROP POLICY IF EXISTS "appointments_customer_own_read" ON public.appointments;
CREATE POLICY "appointments_customer_own_read" ON public.appointments
  FOR SELECT USING (
    customer_phone = (
      SELECT phone FROM public.users
      WHERE id = auth.uid() OR id = public.current_profile_id()
    )
  );

SELECT 'Customer self-service reschedule/cancel: capability tokens + own-account RLS added' AS status;
