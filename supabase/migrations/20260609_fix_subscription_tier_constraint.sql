-- ============================================================
-- Fix distributor registration 500 error
--
-- Root cause: users.subscription_tier had
--   CHECK (subscription_tier IN ('starter','pro','enterprise'))
-- but auth-register inserts 'dist_basic' for distributors (and the app also
-- uses 'dist_trial' / 'basic_distributor'). The insert violated the CHECK,
-- the edge function caught it and returned 500 — so NO distributor could ever
-- register. Shop registration worked only because it uses 'starter'.
--
-- Fix: widen the constraint to include the distributor tiers actually used,
-- and allow NULL (customers have no tier).
-- ============================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;

ALTER TABLE public.users ADD CONSTRAINT users_subscription_tier_check
  CHECK (
    subscription_tier IS NULL OR subscription_tier IN (
      'starter', 'pro', 'enterprise',            -- shop tiers
      'dist_basic', 'dist_pro', 'dist_enterprise', -- distributor tiers
      'dist_trial', 'basic_distributor'           -- legacy/aliases in use
    )
  );

SELECT 'subscription_tier constraint widened to include distributor tiers' AS status;
