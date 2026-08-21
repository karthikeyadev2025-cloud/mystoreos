// Shared server-side price resolution for Razorpay flows.
//
// WHY THIS EXISTS
// ---------------
// razorpay-create-order recomputed the price server-side for
// quarterly and yearly plans only:
//
//   const m = planId.match(/^(starter|pro|...)_(quarterly|yearly)$/);
//   if (m) { ...recompute... }
//   // else: chargeAmount stays as the client sent it
//
// A monthly plan id — 'pro', 'starter', 'enterprise' — does not match
// that pattern, so the amount was taken straight from the request body
// and never checked. Monthly is the default cycle and the most common
// purchase in the product.
//
// The full chain: POST razorpay-create-order with {planId:'pro',
// amount:1} creates a genuine Razorpay order for Rs 1 whose notes say
// planId=pro. Pay it. razorpay-verify-payment then does everything
// right — verifies the HMAC, refuses to trust the client's planId,
// re-fetches the order from Razorpay's API — and the notes it reads
// back say 'pro', because that is what the order was created with. It
// activates a full Pro month for Rs 1.
//
// verify-payment's hardening was never the weak point. The tampering
// happened one step earlier, at order creation, and every later check
// faithfully confirmed the tampered order against itself.
//
// TWO RULES HERE
// --------------
// 1. Every plan id resolves through one function. No cycle is special
//    and none is skipped, so a new plan shape cannot quietly fall into
//    an unvalidated branch the way monthly did.
//
// 2. It FAILS CLOSED. The old code had
//    `catch (_e) { /* fall back to client amount */ }`, so a
//    site_config read that errored — or a pricing_v2 row missing the
//    tier, which made `base` 0 — silently reverted to trusting the
//    client. A price check that falls back to the client's number on
//    error is not a price check. If the price cannot be established,
//    resolvePrice throws and the caller refuses the order.
//
// The catalogue below mirrors src/lib/planCatalogue.js. It is the
// floor used when site_config has no pricing_v2 row at all, not an
// override: admin-set pricing still wins when present.

/** Monthly list price per tier — mirrors src/lib/planCatalogue.js. */
const CATALOGUE: Record<string, number> = {
  starter: 499,
  pro: 999,
  enterprise: 2499,
  service_starter: 249,
  service_pro: 699,
  service_enterprise: 1499,
  basic_distributor: 999,
  pro_distributor: 3499,
  enterprise_distributor: 7999,
};

/** Same derivation as planCatalogue.js: quarterly -10%, yearly -20%. */
const derive = (monthly: number, cycle: string): number =>
  cycle === 'yearly' ? Math.round(monthly * 12 * 0.8)
  : cycle === 'quarterly' ? Math.round(monthly * 3 * 0.9)
  : monthly;

const ADDON_FALLBACK = 199;

export type PlanShape =
  | { kind: 'tier'; tier: string; cycle: 'monthly' | 'quarterly' | 'yearly' }
  | { kind: 'addon'; addon: 'home_service_addon' };

/**
 * Parse a plan id into its shape. Returns null for anything unknown —
 * callers must treat that as a hard rejection, not as "charge whatever
 * the client asked for".
 */
export function parsePlanId(planId: string): PlanShape | null {
  if (planId === 'home_service_addon') return { kind: 'addon', addon: planId };

  const m = planId.match(/^(.+?)_(quarterly|yearly)$/);
  if (m) {
    const [, tier, cycle] = m;
    if (!(tier in CATALOGUE)) return null;
    return { kind: 'tier', tier, cycle: cycle as 'quarterly' | 'yearly' };
  }

  if (planId in CATALOGUE) return { kind: 'tier', tier: planId, cycle: 'monthly' };
  return null;
}

/**
 * The price this plan should cost, in rupees.
 *
 * Order of authority: admin pricing_v2 config, then the catalogue floor.
 * Throws if neither yields a usable number — never falls back to a
 * client-supplied amount.
 *
 * `supabase` is a service-role client.
 */
export async function resolvePrice(
  supabase: { from: (t: string) => any },
  planId: string,
): Promise<number> {
  const shape = parsePlanId(planId);
  if (!shape) throw new Error(`Unknown plan: ${planId}`);

  let cfg: any = null;
  try {
    const { data } = await supabase
      .from('site_config').select('value').eq('key', 'pricing_v2').maybeSingle();
    cfg = data?.value ?? null;
  } catch (_e) {
    // Config unreachable. Fall through to the catalogue floor, which is
    // a real price — NOT to the client's amount.
    cfg = null;
  }

  if (shape.kind === 'addon') {
    const configured = Number(cfg?.addons?.homeService);
    const price = configured > 0 ? configured : ADDON_FALLBACK;
    if (!(price > 0)) throw new Error('Could not resolve add-on price');
    return price;
  }

  const { tier, cycle } = shape;

  // Admin config may state the cycle price directly.
  let base = Number(cfg?.tiers?.[tier]?.[cycle]);

  // Otherwise derive it from the configured monthly, then the catalogue.
  if (!(base > 0)) {
    const monthly = Number(cfg?.tiers?.[tier]?.monthly) || CATALOGUE[tier];
    if (!(monthly > 0)) throw new Error(`Could not resolve price for ${planId}`);
    base = derive(monthly, cycle);
  } else if (cycle !== 'monthly') {
    // A configured cycle price is already discounted; only apply the
    // separate cycle discount when the config supplies one explicitly.
    const cycleDisc = Number(cfg?.discounts?.[cycle]) || 0;
    if (cycleDisc > 0) base = Math.round(base * (1 - cycleDisc / 100));
  }

  // Time-limited promotional offer, if one is running.
  const offerPct = Number(cfg?.offer?.percent) || 0;
  const offerOn = !!cfg?.offer?.enabled && Number(cfg?.offer?.remaining) > 0 && offerPct > 0;
  const final = offerOn ? Math.round(base * (1 - offerPct / 100)) : base;

  if (!(final > 0)) throw new Error(`Resolved a non-positive price for ${planId}`);
  return final;
}

/**
 * Does the amount actually captured match what the plan should cost?
 *
 * Tolerance is one rupee, absorbing rounding between the client's
 * display, paise conversion and an admin price edited mid-checkout.
 * Overpayment is allowed through — refusing to activate a plan someone
 * paid MORE for turns a pricing edge case into a support ticket about
 * a customer who is out of pocket.
 */
export function amountMatches(paid: number, expected: number, toleranceRupees = 1): boolean {
  if (paid >= expected - toleranceRupees) return true;
  return false;
}
