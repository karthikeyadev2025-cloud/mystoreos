// ═══════════════════════════════════════════════════════════════════
// DISTRIBUTOR REPORTS
//
// These became possible only once purchases recorded a real cost basis.
// Before that the app knew what things SOLD for and nothing about what
// they COST, so every "profit" figure would have been a guess.
//
// A note on GST: the existing shop-side GSTR-1 helper divides every
// invoice by 1.18, i.e. assumes 18% on everything. That's fine for a
// single-rate retailer but wrong for a distributor, whose catalogue
// routinely spans 0%, 5%, 12%, 18% and 28% — food is mostly 5%, some
// items are exempt. Applying 18% across the board would overstate
// output tax on most of an FMCG book. These functions use the actual
// per-item rate instead.
// ═══════════════════════════════════════════════════════════════════

const num = (v) => Number(v) || 0;
const inRange = (d, from, to) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= from.getTime() && t <= to.getTime();
};

/**
 * Profit & Loss for a period.
 *
 * Revenue comes from sales; cost of goods sold is computed line by line
 * from each product's recorded cost, NOT from an assumed margin. Lines
 * whose product has no cost recorded yet are counted separately and
 * reported honestly rather than silently treated as zero-cost — which
 * would inflate profit and make the whole report untrustworthy.
 */
export function profitAndLoss({ orders = [], products = [], purchases = [], from, to }) {
  const costOf = {};
  products.forEach(p => { if (p.costPrice != null) costOf[p.id] = num(p.costPrice); });

  let revenue = 0, cogs = 0, unknownCostValue = 0, unknownLines = 0, orderCount = 0;

  orders.filter(o => inRange(o.date || o.createdAt, from, to)).forEach(o => {
    revenue += num(o.total);
    orderCount += 1;
    (o.items || []).forEach(it => {
      const qty = num(it.qty);
      const cost = costOf[it.id];
      if (cost != null) cogs += cost * qty;
      else { unknownCostValue += num(it.price) * qty; unknownLines += 1; }
    });
  });

  // Purchases in the period — shown alongside, not subtracted. Buying
  // stock isn't an expense until it's sold; treating it as one would
  // make any month with a big restock look like a loss.
  const purchaseValue = purchases
    .filter(p => inRange(p.billDate, from, to))
    .reduce((s, p) => s + num(p.total), 0);

  const grossProfit = revenue - cogs;

  return {
    revenue, cogs, grossProfit,
    marginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
    orderCount,
    purchaseValue,
    // Surfaced so the user can see how complete the picture is. A P&L
    // that quietly ignores un-costed stock is worse than one that says
    // so.
    unknownCostValue, unknownLines,
    isComplete: unknownLines === 0,
  };
}

/**
 * GST output summary, grouped by the ACTUAL rate on each line.
 *
 * Sale prices in this app are GST-inclusive, so tax is extracted rather
 * than added: taxable = gross / (1 + rate/100).
 */
export function gstSummary({ orders = [], products = [], from, to }) {
  const rateOf = {};
  products.forEach(p => { rateOf[p.id] = num(p.gstRate); });

  const slabs = {};
  let totalTaxable = 0, totalTax = 0;

  orders.filter(o => inRange(o.date || o.createdAt, from, to)).forEach(o => {
    (o.items || []).forEach(it => {
      const gross = num(it.price) * num(it.qty);
      if (!gross) return;
      const rate = rateOf[it.id] ?? 0;
      const taxable = rate > 0 ? gross / (1 + rate / 100) : gross;
      const tax = gross - taxable;

      if (!slabs[rate]) slabs[rate] = { rate, taxable: 0, tax: 0, cgst: 0, sgst: 0 };
      slabs[rate].taxable += taxable;
      slabs[rate].tax += tax;
      // Intra-state split. Inter-state would be IGST, which needs the
      // buyer's state code — not captured today, so this deliberately
      // reports the common case rather than guessing.
      slabs[rate].cgst += tax / 2;
      slabs[rate].sgst += tax / 2;

      totalTaxable += taxable;
      totalTax += tax;
    });
  });

  return {
    slabs: Object.values(slabs).sort((a, b) => a.rate - b.rate),
    totalTaxable, totalTax,
    cgst: totalTax / 2,
    sgst: totalTax / 2,
  };
}

/**
 * GST input credit from purchases — what the distributor has already
 * paid on stock and can offset against output tax. Purchase lines store
 * gst_pct explicitly, so unlike the sales side there's no extraction
 * needed.
 */
export function inputCreditSummary({ purchases = [], from, to }) {
  let taxable = 0, tax = 0;
  purchases.filter(p => inRange(p.billDate, from, to)).forEach(p => {
    taxable += num(p.subtotal);
    tax += num(p.gstAmount);
  });
  return { taxable, tax, cgst: tax / 2, sgst: tax / 2 };
}

/**
 * Current stock valued at cost — what the inventory is actually worth,
 * as opposed to what it would fetch. Distinguishes items with no
 * recorded cost so the figure isn't quietly understated.
 */
export function stockValuation(products = []) {
  let atCost = 0, atSale = 0, unvaluedItems = 0, unvaluedUnits = 0;
  products.forEach(p => {
    const qty = num(p.stock);
    if (qty <= 0) return;
    atSale += num(p.price) * qty;
    if (p.costPrice != null) atCost += num(p.costPrice) * qty;
    else { unvaluedItems += 1; unvaluedUnits += qty; }
  });
  return {
    atCost, atSale,
    potentialProfit: atSale - atCost,
    unvaluedItems, unvaluedUnits,
  };
}

export default { profitAndLoss, gstSummary, inputCreditSummary, stockValuation };
