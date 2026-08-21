// ═══════════════════════════════════════════════════════════════════
// DISTRIBUTOR BUSINESS INTELLIGENCE
//
// The dashboard showed three numbers: outstanding, collected, retailer
// count. Those are scoreboard figures — true, but they don't tell a
// distributor what to DO today.
//
// The two questions a distribution business actually runs on:
//
//   "Which money is going bad?"     → receivables aging
//   "Which customers am I losing?"  → dormancy detection
//
// Both are computed from data already in the app. No new tables, no
// new queries — this is analysis of what's already loaded, so it costs
// nothing at load time and works offline like the rest of the panel.
// ═══════════════════════════════════════════════════════════════════

const DAY = 86400000;
const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null;

/**
 * Receivables aging — the core credit-control metric in distribution.
 *
 * Money owed 90+ days is frequently unrecoverable, and the difference
 * between a healthy book and a failing one is almost never the TOTAL
 * outstanding (which the dashboard already showed) — it's how that
 * total is distributed across age. ₹5L all under 30 days is a healthy
 * business; ₹5L sitting past 90 days is a crisis, and the old single
 * "Total Outstanding" number rendered both identically.
 */
export function agingBuckets(credits = []) {
  const buckets = {
    current: { label: '0–30 days', amount: 0, count: 0, tone: 'var(--c-success-strong)' },
    d31:     { label: '31–60 days', amount: 0, count: 0, tone: 'var(--c-warning-strong)' },
    d61:     { label: '61–90 days', amount: 0, count: 0, tone: 'var(--c-orange)' },
    d90:     { label: '90+ days',   amount: 0, count: 0, tone: 'var(--c-danger-strong)' },
  };

  credits.filter(c => !c.paid).forEach(c => {
    // Outstanding, not face value — a partly-paid credit should age on
    // what's actually still owed. Negative amounts are return credits,
    // which reduce the balance and shouldn't be aged as debt.
    const owed = Number(c.amount || 0) - Number(c.paidSoFar || 0);
    if (owed <= 0) return;

    const age = daysSince(c.date);
    if (age === null) return;

    const key = age <= 30 ? 'current' : age <= 60 ? 'd31' : age <= 90 ? 'd61' : 'd90';
    buckets[key].amount += owed;
    buckets[key].count += 1;
  });

  const total = Object.values(buckets).reduce((s, b) => s + b.amount, 0);
  // Share of the book that's overdue past 60 days — the single number
  // that most reliably signals a book turning bad.
  const atRisk = buckets.d61.amount + buckets.d90.amount;

  return {
    buckets: Object.values(buckets),
    total,
    atRisk,
    atRiskPct: total > 0 ? Math.round((atRisk / total) * 100) : 0,
  };
}

/**
 * Shops that have gone quiet.
 *
 * In distribution a customer rarely announces they've left — they just
 * stop ordering, and it goes unnoticed for months because nothing in
 * the dashboard counts an absence. A shop that ordered every fortnight
 * and hasn't ordered in 45 days has almost certainly moved to a
 * competitor, and that's recoverable if someone calls this week.
 *
 * Deliberately ranked by revenue at stake, not by how long they've
 * been quiet — losing a ₹2L/month account matters more than a ₹4,000
 * one that's been silent slightly longer.
 */
export function dormantShops(shops = [], orders = [], { quietDays = 30 } = {}) {
  const lastOrder = {};
  const revenue = {};

  orders.forEach(o => {
    if (!o.shopId) return;
    const t = new Date(o.date || o.createdAt || 0).getTime();
    if (!lastOrder[o.shopId] || t > lastOrder[o.shopId]) lastOrder[o.shopId] = t;
    revenue[o.shopId] = (revenue[o.shopId] || 0) + Number(o.total || 0);
  });

  return shops
    .map(s => {
      const last = lastOrder[s.id];
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        // A linked shop that has NEVER ordered is its own signal — they
        // were onboarded and then nothing happened, which usually means
        // the relationship was never actually activated.
        neverOrdered: !last,
        daysQuiet: last ? daysSince(last) : null,
        lifetimeValue: revenue[s.id] || 0,
      };
    })
    .filter(s => s.neverOrdered || (s.daysQuiet !== null && s.daysQuiet >= quietDays))
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);
}

/**
 * Month-on-month revenue movement.
 *
 * A single lifetime "revenue collected" figure only ever goes up, so it
 * cannot show a business shrinking. Comparing the last 30 days against
 * the 30 before it can.
 */
export function revenueTrend(orders = []) {
  const now = Date.now();
  let current = 0, previous = 0;

  orders.forEach(o => {
    const t = new Date(o.date || o.createdAt || 0).getTime();
    if (!t) return;
    const age = (now - t) / DAY;
    if (age <= 30) current += Number(o.total || 0);
    else if (age <= 60) previous += Number(o.total || 0);
  });

  const changePct = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : (current > 0 ? 100 : 0);

  return { current, previous, changePct };
}

export default { agingBuckets, dormantShops, revenueTrend };
