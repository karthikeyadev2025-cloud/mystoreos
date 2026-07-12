-- ═══════════════════════════════════════════════════════════════════════
-- HOME SERVICE ADD-ON — a standalone paid unlock, independent of plan tier.
--
-- Unlike staff scheduling / reminders / recurring bookings (gated by
-- plan tier via PLAN_CAPS in features.js), Home Service Booking is sold
-- as its own add-on: any shop, even Starter, can buy it without
-- upgrading their whole plan. Cheaper than a tier jump, real standalone
-- revenue line.
--
-- Follows the SAME expiry-date pattern the rest of billing already uses
-- (plan_expires_at, distributor_plan_expires_at) rather than a cached
-- boolean flag — gating always does a LIVE comparison against now() at
-- read time, so there's no dependency on a cron job running on schedule
-- to "turn off" access. A stale boolean can drift if a cron is delayed;
-- a live date comparison never can.
--
-- No new RLS grant needed: public.users already has a ROW-LEVEL (not
-- column-restricted) public-read policy for shop profiles
-- (users_select_public_profile: FOR SELECT USING (role = 'shop')) — so
-- the customer-facing booking widget can read this column the same way
-- it already reads subscription_tier for other public-facing checks.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_service_addon_expires_at timestamptz;

SELECT 'home_service_addon_expires_at added — standalone paid add-on, gated by live date comparison' AS status;
