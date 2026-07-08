-- ═══════════════════════════════════════════════════════════════════════
-- RECURRING BOOKINGS  (Enterprise-only)
--
-- Model: MATERIALIZED INSTANCES (Calendly / Google Calendar model).
-- One appointment_series row per repeating booking, plus one child
-- row in appointments per occurrence. Advantages:
--
--   • Existing appointments queries, conflict-checks, reminders, and
--     RLS keep working unchanged — every occurrence is still a normal
--     appointment row.
--   • Per-instance edits work naturally: customer cancels next week
--     without touching the whole series; shop reschedules a single
--     appointment without breaking the rule.
--   • The btree_gist double-booking exclusion constraint still applies
--     across all children — including across series.
--
-- Cost: more rows in appointments (say 4 rows for a monthly repeat over
-- a year). Kept bounded by (a) a MAX-OCCURRENCES cap in the RPC, and
-- (b) a series can be ended by setting ends_on.
--
-- Plan gate: application-side (features.js serviceRecurring) + this
-- migration's create_recurring_appointment() RPC checks the shop's
-- tier and refuses to create the series if the shop isn't on Enterprise.
-- Belt AND suspenders since this is the highest tier.
-- ═══════════════════════════════════════════════════════════════════════

-- ── SERIES TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointment_series (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id          uuid REFERENCES public.services(id) ON DELETE SET NULL,
  service_name        text NOT NULL,
  service_price       numeric(10,2) DEFAULT 0,
  duration_minutes    integer NOT NULL DEFAULT 30,
  provider_id         uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  customer_name       text,
  customer_phone      text,
  -- Recurrence rule. Kept as discrete columns rather than a raw RRULE
  -- string so the RPC can enumerate occurrences without an RRULE
  -- parser (Postgres has no built-in one).
  frequency           text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  interval_count      integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  -- Time-of-day is per-occurrence, but the recurrence itself uses the
  -- same time for every instance (customer books "every Monday at 4pm").
  time_of_day         time NOT NULL,
  -- Start + end of the series.
  starts_on           date NOT NULL,
  ends_on             date,        -- NULL = open-ended (bounded by max_occurrences)
  max_occurrences     integer NOT NULL DEFAULT 12 CHECK (max_occurrences <= 52),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Track which series each appointment belongs to (nullable — one-off
-- bookings still have NULL here). appointment_delete cascades cleanly
-- because the series row is the parent.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.appointment_series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_series_shop ON public.appointment_series (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_series    ON public.appointments (series_id) WHERE series_id IS NOT NULL;

ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "series_shop_owner"      ON public.appointment_series;
CREATE POLICY "series_shop_owner"      ON public.appointment_series
  FOR ALL USING (shop_id = auth.uid() OR shop_id = public.current_profile_id())
       WITH CHECK (shop_id = auth.uid() OR shop_id = public.current_profile_id());

DROP POLICY IF EXISTS "series_admin_read"      ON public.appointment_series;
CREATE POLICY "series_admin_read"      ON public.appointment_series
  FOR SELECT USING (public.current_user_role() = 'admin');


-- ── PLAN-GATE HELPER (Enterprise-only) ────────────────────────────
CREATE OR REPLACE FUNCTION public._shop_has_enterprise(shop_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(subscription_tier, '') = 'enterprise'
  FROM public.users
  WHERE id = shop_uuid;
$$;


-- ── OCCURRENCE ENUMERATION HELPER ─────────────────────────────────
-- Given a series-row shape, generates the list of concrete
-- (appointment_date, appointment_time) instances up to max_occurrences
-- and ends_on. Reused by both the initial materialization and any
-- future "extend series by N more" flow.
CREATE OR REPLACE FUNCTION public._series_occurrences(
  p_starts_on       date,
  p_ends_on         date,
  p_time_of_day     time,
  p_frequency       text,
  p_interval        integer,
  p_max_occurrences integer
) RETURNS TABLE (occ_date date, occ_time time)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  step interval;
  cur  date := p_starts_on;
  n    integer := 0;
  hard_cap integer := LEAST(COALESCE(p_max_occurrences, 12), 52);
BEGIN
  step := CASE p_frequency
    WHEN 'daily'   THEN make_interval(days   => p_interval)
    WHEN 'weekly'  THEN make_interval(weeks  => p_interval)
    WHEN 'monthly' THEN make_interval(months => p_interval)
  END;

  WHILE n < hard_cap AND (p_ends_on IS NULL OR cur <= p_ends_on) LOOP
    occ_date := cur;
    occ_time := p_time_of_day;
    RETURN NEXT;
    cur := (cur + step)::date;
    n := n + 1;
  END LOOP;
END;
$$;


-- ── PUBLIC RPC: CREATE A RECURRING SERIES + MATERIALIZE INSTANCES ─
-- Called from the app when a shop books a recurring appointment.
-- Enforces the Enterprise gate; returns the created series row + how
-- many instances were materialized (rejected via conflict, skipped).
--
-- Skips (not errors) any occurrence that would conflict with an
-- existing appointment. Conflicts are counted so the caller can show
-- "10 of 12 booked — 2 skipped (already booked)".
--
-- Provider assignment is honored across all occurrences (customer
-- wants the same stylist every week).
CREATE OR REPLACE FUNCTION public.create_recurring_appointment(
  p_shop_id         uuid,
  p_service_id      uuid,
  p_service_name    text,
  p_service_price   numeric,
  p_duration_min    integer,
  p_customer_name   text,
  p_customer_phone  text,
  p_time_of_day     time,
  p_starts_on       date,
  p_frequency       text,
  p_interval        integer DEFAULT 1,
  p_max_occurrences integer DEFAULT 12,
  p_ends_on         date DEFAULT NULL,
  p_provider_id     uuid DEFAULT NULL,
  p_status          text DEFAULT 'confirmed'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_series_id   uuid;
  occ             record;
  materialized    integer := 0;
  skipped         integer := 0;
BEGIN
  -- Plan gate: only Enterprise shops can create recurring series.
  IF NOT public._shop_has_enterprise(p_shop_id) THEN
    RAISE EXCEPTION 'Recurring bookings require Enterprise Plan' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ownership guard — only the shop owner (or admin) can create for this shop.
  IF NOT (auth.uid() = p_shop_id OR public.current_profile_id() = p_shop_id OR public.current_user_role() = 'admin') THEN
    RAISE EXCEPTION 'Not authorized to book for this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Create the series row.
  INSERT INTO public.appointment_series (
    shop_id, service_id, service_name, service_price, duration_minutes,
    provider_id, customer_name, customer_phone,
    frequency, interval_count, time_of_day,
    starts_on, ends_on, max_occurrences, status
  ) VALUES (
    p_shop_id, p_service_id, p_service_name, COALESCE(p_service_price, 0), p_duration_min,
    p_provider_id, p_customer_name, p_customer_phone,
    p_frequency, GREATEST(1, p_interval), p_time_of_day,
    p_starts_on, p_ends_on, LEAST(GREATEST(1, p_max_occurrences), 52), 'active'
  ) RETURNING id INTO new_series_id;

  -- Materialize each occurrence. Any that would conflict with an
  -- existing appointment (via the exclusion constraint from
  -- 20260705_appointment_no_overlap.sql) is skipped — no exception,
  -- just counted so the caller can report to the user.
  FOR occ IN SELECT * FROM public._series_occurrences(
    p_starts_on, p_ends_on, p_time_of_day, p_frequency, GREATEST(1, p_interval), LEAST(GREATEST(1, p_max_occurrences), 52)
  ) LOOP
    BEGIN
      INSERT INTO public.appointments (
        shop_id, service_id, service_name, service_price, duration_minutes,
        customer_name, customer_phone,
        appointment_date, appointment_time,
        booked_via, provider_id, status, series_id
      ) VALUES (
        p_shop_id, p_service_id, p_service_name, COALESCE(p_service_price, 0), p_duration_min,
        p_customer_name, p_customer_phone,
        occ.occ_date, occ.occ_time,
        'recurring', p_provider_id, p_status, new_series_id
      );
      materialized := materialized + 1;
    EXCEPTION WHEN exclusion_violation THEN
      skipped := skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'series_id',    new_series_id,
    'materialized', materialized,
    'skipped',      skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_recurring_appointment(uuid, uuid, text, numeric, integer, text, text, time, date, text, integer, integer, date, uuid, text) TO authenticated;

SELECT 'recurring bookings installed' AS status;
