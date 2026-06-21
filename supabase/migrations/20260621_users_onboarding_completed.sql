-- ─────────────────────────────────────────────────────────────────────────
-- Resume-onboarding gap fix: a shop owner who closed the browser mid-
-- onboarding (after step 0 or 1) used to land on /waiting on next login
-- because RoleRouter only checked status='pending' and had no way to
-- distinguish "submitted everything, waiting for admin" from "still
-- needs to fill in their business info." Admin then saw a half-filled
-- application and couldn't approve.
--
-- Now: explicit flag. Set to FALSE only during fresh shop/distributor
-- registration; set to TRUE when the onboarding form completes (step 3).
-- RoleRouter + WaitingApproval check this and redirect to /onboarding
-- instead of /waiting when it's false.
-- ─────────────────────────────────────────────────────────────────────────

-- Default TRUE intentionally: every EXISTING pending shop today must
-- have either completed onboarding under the old flow or is in some
-- in-between state we can't recover. Treating them as completed keeps
-- current behavior unchanged for those rows. Only freshly-registered
-- accounts after this migration runs will start as FALSE and be steered
-- back to /onboarding until they finish.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT true;
