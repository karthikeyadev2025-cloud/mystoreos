-- ─────────────────────────────────────────────────────────────────────────
-- Buffer time between appointments
--
-- Standard scheduling-software feature: "a configurable gap between
-- appointments, preventing back-to-back bookings and giving staff time
-- to prepare or clean up" (e.g. a stylist wants 10 minutes between
-- clients to clean their station and reset).
--
-- Scoped per-PROVIDER (not per-service) — matches the majority use case
-- of "this person needs X minutes between clients regardless of which
-- service," and keeps the schema/UI simpler than per-service buffers.
--
-- HONEST LIMITATION: buffer time is enforced at the APPLICATION level
-- only (see api.getProviderAvailability), not in the database-level
-- exclusion constraint added in 20260705_providers_staff_assignment.sql.
-- Postgres generated columns cannot reference other tables, so the
-- constraint can't look up a provider's buffer_minutes to extend the
-- blocked range. This means the DB-level safety net still only
-- guarantees no EXACT time overlap — the buffer itself relies on the
-- app-level check, which covers the real-world case (both the
-- storefront widget and the owner's walk-in form correctly grey out
-- buffer-blocked slots) but has the same small race-condition
-- theoretical gap that motivated the DB constraint in the first place.
-- Acceptable tradeoff: a genuine double-booking (exact same minute) is
-- still structurally prevented; a race-condition booking landing
-- slightly inside someone's buffer window is a much smaller, cosmetic
-- issue (a few minutes tight, not a full conflict).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0;

SELECT 'Buffer time (per-provider) added' AS status;
