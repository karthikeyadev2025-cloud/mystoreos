-- ─────────────────────────────────────────────────────────────────────────
-- PRIVACY FIX: appointments table was fully readable by ANY anonymous
-- visitor — every customer's name and phone number, for every shop, was
-- exposed via a `FOR SELECT USING (true)` policy. The comment on that
-- policy said "filter by phone in app layer," but that filtering was
-- never actually enforced anywhere — it was a client-side-only intention
-- that gave zero real protection, since anyone can call the Supabase API
-- directly and bypass whatever the frontend code does.
--
-- getCustomerAppointments() (the function this open policy existed for)
-- is defined in api.js but was never wired into any UI — no "My
-- Bookings" screen exists yet — so removing this policy breaks nothing
-- currently working.
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "appointments_customer_select" ON public.appointments;

-- Narrow, PII-free policy: customers browsing the booking widget need to
-- see WHICH time slots are taken (for double-booking prevention / greyed-
-- out slot UI) but never WHO booked them. RLS in Postgres is row-level,
-- not column-level, so column-level protection needs actual column
-- GRANTs — revoke broad SELECT from anon and grant back only the
-- non-identifying columns needed for slot-conflict checking.
REVOKE SELECT ON public.appointments FROM anon;
GRANT SELECT (id, shop_id, appointment_date, appointment_time, duration_minutes, status)
  ON public.appointments TO anon;

CREATE POLICY "appointments_public_slot_check" ON public.appointments
  FOR SELECT USING (true);
-- Safe because anon can only see the 6 non-identifying columns granted
-- above — customer_name, customer_phone, service_name, notes, etc. are
-- NOT accessible to anon regardless of what this row-level policy allows,
-- since GRANT is enforced independently of and in addition to RLS.

-- Shop owner / staff keep full access to every column via the existing
-- appointments_owner_all policy (current_user_shop_id()) — unaffected by
-- this change, since authenticated shop accounts are a different grantee
-- (authenticated, which already has GRANT ALL from the original migration).

SELECT 'appointments table: anon access narrowed to non-identifying columns only' AS status;
