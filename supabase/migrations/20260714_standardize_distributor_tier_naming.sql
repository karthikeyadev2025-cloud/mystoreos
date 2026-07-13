-- ═══════════════════════════════════════════════════════════════════════
-- Cleanup: standardize subscription_tier naming for distributor accounts.
--
-- New signups already fixed at the source (auth-register + api.js) to
-- write 'basic_distributor' instead of the legacy 'dist_basic' alias.
-- This backfills EXISTING rows for full consistency going forward.
--
-- Confirmed safe before writing this: subscription_tier's value is
-- never actually read for a distributor account's capabilities or
-- revenue calculations — that's what distributor_plan_tier (a
-- separate column, its own DB default, its own CHECK constraint) is
-- for, per getDistCaps() and isPaidDist() in src/lib/api.js. This is a
-- pure naming consistency cleanup, not a fix for a live functional bug.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE public.users SET subscription_tier = 'basic_distributor'
  WHERE subscription_tier = 'dist_basic';

UPDATE public.users SET subscription_tier = 'pro_distributor'
  WHERE subscription_tier = 'dist_pro';

UPDATE public.users SET subscription_tier = 'enterprise_distributor'
  WHERE subscription_tier = 'dist_enterprise';

SELECT 'distributor subscription_tier values standardized to basic_distributor/pro_distributor/enterprise_distributor' AS status;
