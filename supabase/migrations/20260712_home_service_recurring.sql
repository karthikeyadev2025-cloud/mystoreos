-- ═══════════════════════════════════════════════════════════════════════
-- Extend create_recurring_appointment for home-service bookings, and fix
-- the same staff-ownership regression already found and fixed elsewhere
-- this session (owns_shop() not accounting for staff_of).
--
-- Two changes:
--
-- 1. HOME SERVICE — a recurring series can now be for a home visit (e.g.
--    weekly home physiotherapy, recurring home cleaning), carrying the
--    same service_location/customer_address/home_service_fee shape every
--    materialized occurrence already gets from a one-off booking.
--    Added to appointment_series too (not just appointments) so the
--    series itself remembers it was a home-visit series, in case a
--    future 'extend this series' feature needs to regenerate more
--    occurrences from it.
--
-- 2. OWNERSHIP CHECK BUG — this function's authorization check used
--       auth.uid() = p_shop_id OR current_profile_id() = p_shop_id
--    current_profile_id() resolves to the CALLER'S OWN id, with no
--    staff_of resolution — identical shape to the owns_shop() regression
--    documented in 20260712_fix_owns_shop_staff_regression.sql. A staff
--    member (whose current_profile_id() is their own staff account id,
--    never equal to the shop's id) would be silently blocked from
--    creating a recurring series for the shop they work at, even though
--    Enterprise-tier staff should be able to. Fixed to use owns_shop(),
--    already fixed at its source to resolve staff_of correctly.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.appointment_series
  ADD COLUMN IF NOT EXISTS service_location text NOT NULL DEFAULT 'in_shop'
    CHECK (service_location IN ('in_shop', 'at_home')),
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS home_service_fee numeric(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_recurring_appointment(
  p_shop_id            uuid,
  p_service_id         uuid,
  p_service_name       text,
  p_service_price      numeric,
  p_duration_min       integer,
  p_customer_name      text,
  p_customer_phone     text,
  p_time_of_day        time,
  p_starts_on          date,
  p_frequency          text,
  p_interval           integer DEFAULT 1,
  p_max_occurrences    integer DEFAULT 12,
  p_ends_on            date DEFAULT NULL,
  p_provider_id        uuid DEFAULT NULL,
  p_status             text DEFAULT 'confirmed',
  p_service_location   text DEFAULT 'in_shop',
  p_customer_address   text DEFAULT NULL,
  p_home_service_fee   numeric DEFAULT 0
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

  -- Guard: a home-visit series must carry a real address, same rule the
  -- appointments table itself already enforces per-occurrence via
  -- appointments_home_address_required — checked here too so the error
  -- surfaces immediately instead of after N materialization attempts.
  IF p_service_location = 'at_home' AND (p_customer_address IS NULL OR length(trim(p_customer_address)) = 0) THEN
    RAISE EXCEPTION 'An address is required for a home visit series' USING ERRCODE = 'check_violation';
  END IF;

  -- Ownership guard — was current_profile_id() (own id only, no staff_of
  -- resolution). Fixed to owns_shop(), the shared function already fixed
  -- to resolve staff sessions to the shop they work at.
  IF NOT (public.owns_shop(p_shop_id) OR public.current_user_role() = 'admin') THEN
    RAISE EXCEPTION 'Not authorized to book for this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Create the series row.
  INSERT INTO public.appointment_series (
    shop_id, service_id, service_name, service_price, duration_minutes,
    provider_id, customer_name, customer_phone,
    frequency, interval_count, time_of_day,
    starts_on, ends_on, max_occurrences, status,
    service_location, customer_address, home_service_fee
  ) VALUES (
    p_shop_id, p_service_id, p_service_name, COALESCE(p_service_price, 0), p_duration_min,
    p_provider_id, p_customer_name, p_customer_phone,
    p_frequency, GREATEST(1, p_interval), p_time_of_day,
    p_starts_on, p_ends_on, LEAST(GREATEST(1, p_max_occurrences), 52), 'active',
    p_service_location, p_customer_address, COALESCE(p_home_service_fee, 0)
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
        booked_via, provider_id, status, series_id,
        service_location, customer_address, home_service_fee
      ) VALUES (
        p_shop_id, p_service_id, p_service_name, COALESCE(p_service_price, 0), p_duration_min,
        p_customer_name, p_customer_phone,
        occ.occ_date, occ.occ_time,
        'recurring', p_provider_id, p_status, new_series_id,
        p_service_location, p_customer_address, COALESCE(p_home_service_fee, 0)
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

SELECT 'recurring appointments now support home-service bookings, and the staff-ownership regression is fixed' AS status;
