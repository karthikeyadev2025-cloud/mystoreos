// Pricing / underpayment guard.  node tests/db/pricing.test.mjs
//
// Reproduces the vulnerability the P5 pass found, then checks the fix.
//
// THE BUG: razorpay-create-order validated the price for quarterly and
// yearly plans only —
//
//     const m = planId.match(/^(starter|pro|...)_(quarterly|yearly)$/);
//     if (m) { ...recompute server-side... }
//     // monthly falls through with the client's amount
//
// 'pro' does not match, so {planId:'pro', amount:1} minted a real Rs 1
// Razorpay order whose notes said planId=pro. verify-payment then did
// everything correctly — HMAC verified, client planId distrusted, order
// re-fetched from Razorpay — and read back 'pro' from those notes,
// because that is what the order was created with. Full Pro month, Rs 1.
//
// Monthly is the default cycle, so this was the common path.
//
// The logic under test is inlined below rather than imported: the
// implementations are Deno TypeScript with remote esm.sh imports, which
// Node cannot load. The OLD block is copied verbatim from the pre-fix
// create-order; the NEW one mirrors _shared/pricing.ts. Divergence
// between this mirror and the real resolver is the standing risk with
// this approach, so keep them in step.

const ok = [], bad = [];
const check = (n, c, d = '') =>
  (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '\n        ' + d : ''}`);

const CATALOGUE = {
  starter: 499, pro: 999, enterprise: 2499,
  service_starter: 249, service_pro: 699, service_enterprise: 1499,
  basic_distributor: 999, pro_distributor: 3499, enterprise_distributor: 7999,
};
const derive = (m, cycle) =>
  cycle === 'yearly' ? Math.round(m * 12 * 0.8)
  : cycle === 'quarterly' ? Math.round(m * 3 * 0.9)
  : m;

/* ---- OLD behaviour, verbatim from pre-fix create-order ---- */
function oldChargeAmount(planId, clientAmount, cfg) {
  let chargeAmount = clientAmount;
  const m = planId.match(
    /^(starter|pro|enterprise|service_starter|service_pro|service_enterprise|basic_distributor|pro_distributor|enterprise_distributor)_(quarterly|yearly)$/);
  if (m) {
    try {
      const base = Number(cfg?.tiers?.[m[1]]?.[m[2]]) || 0;
      if (base > 0) {
        const d = Number(cfg?.discounts?.[m[2]]) || 0;
        chargeAmount = Math.round(base * (1 - d / 100));
      }
    } catch { /* falls back to client amount */ }
  }
  if (planId === 'home_service_addon') chargeAmount = 199;
  return chargeAmount;
}

/* ---- NEW behaviour, mirroring _shared/pricing.ts ---- */
function parsePlanId(planId) {
  if (planId === 'home_service_addon') return { kind: 'addon' };
  const m = planId.match(/^(.+?)_(quarterly|yearly)$/);
  if (m) return (m[1] in CATALOGUE) ? { kind: 'tier', tier: m[1], cycle: m[2] } : null;
  return (planId in CATALOGUE) ? { kind: 'tier', tier: planId, cycle: 'monthly' } : null;
}
function resolvePrice(planId, cfg) {
  const shape = parsePlanId(planId);
  if (!shape) throw new Error(`Unknown plan: ${planId}`);
  if (shape.kind === 'addon') {
    const c = Number(cfg?.addons?.homeService);
    return c > 0 ? c : 199;
  }
  const { tier, cycle } = shape;
  let base = Number(cfg?.tiers?.[tier]?.[cycle]);
  if (!(base > 0)) {
    const monthly = Number(cfg?.tiers?.[tier]?.monthly) || CATALOGUE[tier];
    if (!(monthly > 0)) throw new Error(`Could not resolve price for ${planId}`);
    base = derive(monthly, cycle);
  } else if (cycle !== 'monthly') {
    const d = Number(cfg?.discounts?.[cycle]) || 0;
    if (d > 0) base = Math.round(base * (1 - d / 100));
  }
  const pct = Number(cfg?.offer?.percent) || 0;
  const on = !!cfg?.offer?.enabled && Number(cfg?.offer?.remaining) > 0 && pct > 0;
  const final = on ? Math.round(base * (1 - pct / 100)) : base;
  if (!(final > 0)) throw new Error(`Non-positive price for ${planId}`);
  return final;
}
const amountMatches = (paid, expected, tol = 1) => paid >= expected - tol;

const CFG = {
  tiers: { pro: { monthly: 999, quarterly: 2697, yearly: 9590 } },
  discounts: {}, offer: { enabled: false },
};

/* ════ 1. the exploit, before the fix ════ */
check('OLD: monthly plan accepts a Rs 1 amount',
      oldChargeAmount('pro', 1, CFG) === 1,
      "create-order would mint a Rs 1 order with notes planId=pro");

check('OLD: every monthly tier is exploitable',
      Object.keys(CATALOGUE).every((t) => oldChargeAmount(t, 1, CFG) === 1),
      `${Object.keys(CATALOGUE).length} tiers, all unvalidated on the monthly cycle`);

check('OLD: quarterly/yearly WERE protected',
      oldChargeAmount('pro_quarterly', 1, CFG) === 2697,
      'which is why the gap went unnoticed — the discounted paths looked right');

check('OLD: fails OPEN when config is missing',
      oldChargeAmount('pro_yearly', 1, {}) === 1,
      'no pricing_v2 row => base is 0 => client amount trusted, even on yearly');

/* ════ 2. after the fix ════ */
check('NEW: monthly resolves to list price',
      resolvePrice('pro', CFG) === 999, `got ${resolvePrice('pro', CFG)}`);
check('NEW: every monthly tier priced from catalogue',
      Object.keys(CATALOGUE).every((t) => resolvePrice(t, {}) === CATALOGUE[t]));
check('NEW: quarterly unchanged', resolvePrice('pro_quarterly', CFG) === 2697);
check('NEW: yearly unchanged',    resolvePrice('pro_yearly', CFG) === 9590);

check('NEW: fails CLOSED on missing config (derives, never trusts client)',
      resolvePrice('pro_yearly', {}) === derive(999, 'yearly'),
      `${resolvePrice('pro_yearly', {})} — from the catalogue floor, not the client`);

let threw = false;
try { resolvePrice('pro_lifetime', CFG); } catch { threw = true; }
check('NEW: unknown plan id is rejected, not priced', threw);

threw = false;
try { resolvePrice('', CFG); } catch { threw = true; }
check('NEW: empty plan id is rejected', threw);

/* ════ 3. the verify-payment gate ════ */
check('GATE: Rs 1 against a Rs 999 plan is refused',
      !amountMatches(1, resolvePrice('pro', CFG)));
check('GATE: correct payment is accepted',
      amountMatches(999, resolvePrice('pro', CFG)));
check('GATE: 1 rupee rounding tolerance allowed',
      amountMatches(998, 999));
check('GATE: 2 rupees short is refused',
      !amountMatches(997, 999));
check('GATE: overpayment is accepted (never strand a paying customer)',
      amountMatches(1200, 999));

/* ════ 4. promotional offer still applies ════ */
const OFFER = { ...CFG, offer: { enabled: true, remaining: 5, percent: 50 } };
check('OFFER: 50% offer halves the monthly price',
      resolvePrice('pro', OFFER) === 500, `got ${resolvePrice('pro', OFFER)}`);
check('OFFER: gate accepts the discounted amount',
      amountMatches(500, resolvePrice('pro', OFFER)));
check('OFFER: exhausted offer reverts to list price',
      resolvePrice('pro', { ...CFG, offer: { enabled: true, remaining: 0, percent: 50 } }) === 999);

/* ════ 5. add-on ════ */
check('ADDON: falls back to 199', resolvePrice('home_service_addon', {}) === 199);
check('ADDON: admin price wins',
      resolvePrice('home_service_addon', { addons: { homeService: 299 } }) === 299);

console.log('\n' + [...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
