-- ─────────────────────────────────────────────────────────────────────────
-- Double-booking prevention — database-level enforcement
--
-- The app already checks for conflicts before inserting (see
-- api.checkAppointmentConflict), but that check-then-insert has a small
-- race-condition window: two customers submitting a booking for the
-- exact same shop+time within milliseconds of each other could both pass
-- the app-level check before either insert lands. This is a well-known
-- gap when conflict-checking lives only in application code — the fix
-- used by every real scheduling product is a database-level exclusion
-- constraint, which PostgreSQL can enforce natively with the btree_gist
-- extension.
--
-- Scoped PER SHOP (not per staff member) — matches the app-level check
-- in api.js. Once staff assignment ships, this constraint should be
-- updated to also partition on staff_id so two different staff can
-- legitimately have overlapping appointments.
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;
-- On Supabase, extensions install into the `extensions` schema — without
-- this, the gist operator classes aren't findable and the constraint
-- fails with: 'data type uuid has no default operator class for gist'.
SET search_path TO public, extensions;

-- A generated column expressing each appointment as a time range, so
-- Postgres can use its native range-overlap operators.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS time_range tsrange
  GENERATED ALWAYS AS (
    tsrange(
      (appointment_date + appointment_time)::timestamp,
      -- make_interval() is IMMUTABLE; the old (text || ' minutes')::interval
      -- cast is only STABLE, which Postgres rejects in generated columns
      (appointment_date + appointment_time)::timestamp + make_interval(mins => duration_minutes)
    )
  ) STORED;

-- Exclude overlapping ranges for the same shop, but only among
-- non-cancelled appointments — a cancelled slot should free up the time.
DROP INDEX IF EXISTS appointments_no_overlap;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    shop_id WITH =,
    time_range WITH &&
  ) WHERE (status <> 'cancelled');

SELECT 'Double-booking prevention: DB-level exclusion constraint added' AS status;
