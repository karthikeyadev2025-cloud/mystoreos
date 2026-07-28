// ═══════════════════════════════════════════════════════════════════
// PLAN CATALOGUE — THE SINGLE SOURCE OF TRUTH FOR PRICING
//
// Prices were previously hardcoded in SIX independent places:
//   1. api.js  getPricing() seed
//   2. api.js  getDistributorSubscriptionPlans()
//   3. api.js  DIST_PRICES / SHOP_PRICES revenue fallbacks
//   4. Pricing.jsx  DIST_PLANS / SERVICE_PLANS
//   5. LandingPage.jsx  DSP_FB / SSP_FB / DDP_FB
//   6. admin TabDistributors.jsx  tierPrices defaults
//
// Updating distributor pricing meant editing five of them and missing
// one — which is exactly what happened: the billing dashboard kept
// showing the old figures because getDistributorSubscriptionPlans()
// was never updated. A customer could see one price on the landing
// page and a different one on the upgrade screen.
//
// Everything now derives from PLAN_CATALOGUE below. Change a price
// here and it changes everywhere, including the seed written to the
// database.
//
// RUNTIME PRECEDENCE (unchanged): whatever an admin has saved in
// site_config still wins at runtime. This file is the DEFAULT and the
// seed — not an override. That's deliberate: an admin who lowers a
// price for a promotion must not have it silently reverted by a deploy.
// ═══════════════════════════════════════════════════════════════════

// Quarterly = 3 months less 10%. Yearly = 12 months less 20%.
// Kept as a function rather than hand-typed numbers, because the
// hand-typed ones were the thing that drifted.
const derive = (monthly) => ({
  monthly,
  quarterly: Math.round(monthly * 3 * 0.9),
  yearly: Math.round(monthly * 12 * 0.8),
});

export const PLAN_CATALOGUE = {
  // ── RETAIL SHOP ──────────────────────────────────────────────────
  starter:    { label: 'Starter',    ...derive(499) },
  pro:        { label: 'PRO',        ...derive(999) },
  enterprise: { label: 'Enterprise', ...derive(2499) },

  // ── SERVICE BUSINESS ─────────────────────────────────────────────
  service_starter:    { label: 'Starter',    ...derive(249) },
  service_pro:        { label: 'PRO',        ...derive(699) },
  service_enterprise: { label: 'Enterprise', ...derive(1499) },

  // ── DISTRIBUTOR ──────────────────────────────────────────────────
  basic_distributor:      { label: 'Basic Distributor',      ...derive(999) },
  pro_distributor:        { label: 'Pro Distributor',        ...derive(3499) },
  enterprise_distributor: { label: 'Enterprise Distributor', ...derive(7999) },
};

/** Monthly price for a tier. Single lookup used by every caller. */
export const priceOf = (tierId) => PLAN_CATALOGUE[tierId]?.monthly ?? 0;

/**
 * The full tiers object in the exact shape getPricing() and
 * site_config expect, so the database seed is generated from the same
 * numbers the UI renders rather than typed a second time.
 */
export const tiersSeed = () =>
  Object.fromEntries(
    Object.entries(PLAN_CATALOGUE).map(([id, t]) => [
      id, { monthly: t.monthly, quarterly: t.quarterly, yearly: t.yearly },
    ])
  );

export default PLAN_CATALOGUE;
