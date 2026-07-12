-- ═══════════════════════════════════════════════════════════════════════
-- COMPLETION CONFIRMATION — who finished the job, and when.
--
-- For an in-shop appointment, the owner can usually see for themselves
-- that a service happened. For a HOME visit, nobody at the shop
-- witnesses it — the only record that the work was actually done is
-- whichever staff member taps 'Complete & Bill' from wherever they are.
-- Right now that action just flips status to 'completed' with no trace
-- of who confirmed it or when relative to the appointment slot. Adding
-- a real audit trail: completed_by (the account that confirmed) and
-- completed_at (a timestamp independent of updated_at, so a later,
-- unrelated edit to the row — e.g. correcting a typo in the customer's
-- address — can never be mistaken for a new completion time).
--
-- completed_by_name is denormalised (captured at completion time)
-- for the same reason customer_name/service_name already are on this
-- table: if the staff account is later deleted, the record of who did
-- the work should survive.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by_name text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

SELECT 'appointments.completed_by/completed_by_name/completed_at added — real completion audit trail' AS status;
