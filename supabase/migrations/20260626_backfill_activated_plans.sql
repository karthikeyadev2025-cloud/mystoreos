-- ─────────────────────────────────────────────────────────────────────────
-- Backfill: shops the admin already upgraded to a paid plan, but whose
-- `subscription` column is still literally 'trial' because
-- updateUserSubscription() never touched that column (bug fixed in
-- api.js — this is the one-time catch-up for rows written before the fix).
--
-- Safe / idempotent: only touches rows where subscriptionTier is a real
-- paid tier AND subscription is still 'trial'.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE public.users
SET subscription = 'active'
WHERE role = 'shop'
  AND subscription = 'trial'
  AND subscription_tier IN ('starter', 'pro', 'enterprise');

SELECT 'Backfilled subscription=active for shops with an admin-assigned paid tier' AS status;
