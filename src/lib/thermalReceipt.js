// Thermal receipt printing via native HTML — NOT jsPDF.
//
// Why a separate path from the PDF flow:
//   Printing a jsPDF blob for thermal never works reliably. The browser
//   renders the PDF in its plugin viewer, and calling window.print()
//   on a wrapper page prints the wrapper geometry, not the embedded
//   PDF's page size. Chrome, Edge, and Safari each behave differently;
//   the common failure is the 80mm receipt landing on A4.
//
//   Native HTML print respects `@page { size: 80mm auto }` exactly,
//   because there's no PDF plugin in the loop — the browser lays the
//   content out itself and the print CSS is authoritative. This is how
//   every reliable web-based thermal POS prints (Vyapar web, Petpooja,
//   etc). So for thermal we render the receipt as plain HTML and print
//   that; A4 can keep using the richer jsPDF path.
//
// The HTML is intentionally minimal and monospace so columns line up
// on a fixed-width roll. Font sizes are tuned for 58mm and 80mm.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(n) {
  const v = Number(n) || 0;
  return v.toFixed(2);
}

// Build the receipt HTML string.
//
// data shape:
// {
//   shopName, shopPhone, shopAddress, gstin,
//   modeTitle ('TAX INVOICE' / 'ESTIMATE' / 'SERVICE BILL'),
//   billNo, dateStr,
//   customerName, customerPhone,
//   items: [{ name, qty, price, discountPct }],
//   subtotal, itemSavings, billDiscount, loyaltyRedeemed, roundOff, total,
//   paymentMode, footerNote,
//   upiRef (optional)
// }
export function buildThermalReceiptHtml(data, widthMm) {
  const W = widthMm === 58 ? 58 : 80;
  // Character grid: 58mm ≈ 32 cols, 80mm ≈ 42 cols at the chosen font.
  const cols = W === 58 ? 32 : 42;
  const line = '-'.repeat(cols);
  const fontPx = W === 58 ? 9 : 11;

  const itemRows = (data.items || []).map((it, i) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const disc = Number(it.discountPct) || 0;
    const gross = qty * price;
    const net = disc > 0 ? gross * (1 - disc / 100) : gross;
    // Line 1: index + name (name wraps if long). Line 2: qty x price = amount
    const nameLine = `${i + 1}. ${esc(it.name)}`;
    const calcLine = `${qty} x ${money(price)}${disc > 0 ? ` -${disc}%` : ''}`;
    return `
      <div class="item">
        <div class="item-name">${nameLine}</div>
        <div class="item-calc">
          <span>${calcLine}</span>
          <span>${money(net)}</span>
        </div>
      </div>`;
  }).join('');

  const totalsRow = (label, value, opts = {}) => `
    <div class="trow ${opts.strong ? 'strong' : ''}" ${opts.color ? `style="color:${opts.color}"` : ''}>
      <span>${esc(label)}</span><span>${esc(value)}</span>
    </div>`;

  const parts = [];
  parts.push(`<div class="center bold big">${esc(data.shopName || 'Shop')}</div>`);
  if (data.shopAddress) parts.push(`<div class="center small">${esc(data.shopAddress)}</div>`);
  if (data.shopPhone)   parts.push(`<div class="center small">Ph: ${esc(data.shopPhone)}</div>`);
  if (data.gstin)       parts.push(`<div class="center small">GSTIN: ${esc(data.gstin)}</div>`);
  parts.push(`<div class="rule">${line}</div>`);
  parts.push(`<div class="center bold">${esc(data.modeTitle || 'BILL')}</div>`);
  const metaBits = [];
  if (data.billNo)  metaBits.push(`Bill: ${esc(data.billNo)}`);
  if (data.dateStr) metaBits.push(esc(data.dateStr));
  if (metaBits.length) parts.push(`<div class="center small">${metaBits.join('  ')}</div>`);
  if (data.customerName) {
    parts.push(`<div class="rule">${line}</div>`);
    parts.push(`<div class="small">Bill To: ${esc(data.customerName)}${data.customerPhone ? ` (${esc(data.customerPhone)})` : ''}</div>`);
  }
  parts.push(`<div class="rule">${line}</div>`);
  parts.push(itemRows);
  parts.push(`<div class="rule">${line}</div>`);

  // Totals
  parts.push(totalsRow('Subtotal', `Rs. ${money(data.subtotal)}`));
  if (data.itemSavings > 0)     parts.push(totalsRow('Item Discounts', `-Rs. ${money(data.itemSavings)}`, { color: '#15803D' }));
  if (data.billDiscount > 0)    parts.push(totalsRow('Bill Discount', `-Rs. ${money(data.billDiscount)}`, { color: '#15803D' }));
  if (data.loyaltyRedeemed > 0) parts.push(totalsRow('Loyalty Redeemed', `-Rs. ${money(data.loyaltyRedeemed)}`, { color: '#4A7CAD' }));
  if (data.roundOff && Number(data.roundOff) !== 0) {
    const r = Number(data.roundOff);
    parts.push(totalsRow('Round Off', `${r > 0 ? '+' : ''}Rs. ${money(r)}`));
  }
  parts.push(`<div class="rule">${line}</div>`);
  parts.push(totalsRow('TOTAL', `Rs. ${money(data.total)}`, { strong: true }));
  if (data.paymentMode) parts.push(`<div class="small" style="margin-top:4px">Paid via: ${esc(data.paymentMode)}</div>`);
  if (data.upiRef)      parts.push(`<div class="small">Ref: ${esc(data.upiRef)}</div>`);
  parts.push(`<div class="rule">${line}</div>`);
  parts.push(`<div class="center small">${esc(data.footerNote || 'Thank you! Visit again.')}</div>`);
  parts.push(`<div class="center tiny">Powered by MyStore OS</div>`);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(data.shopName || 'Receipt')}</title>
<style>
  @page { size: ${W}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html { width: ${W}mm; }
  body {
    width: ${W}mm;
    max-width: ${W}mm;
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: ${fontPx}px;
    line-height: 1.35;
    color: #000;
    padding: 3mm 2mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: ${fontPx + 3}px; }
  .small { font-size: ${fontPx - 1}px; }
  .tiny { font-size: ${fontPx - 2}px; color: #444; margin-top: 2px; }
  .rule { white-space: nowrap; overflow: hidden; letter-spacing: -0.5px; margin: 3px 0; }
  .item { margin-bottom: 2px; }
  .item-name { word-break: break-word; }
  .item-calc { display: flex; justify-content: space-between; }
  .trow { display: flex; justify-content: space-between; }
  .trow.strong { font-weight: 800; font-size: ${fontPx + 2}px; }
  @media print {
    html, body { width: ${W}mm !important; max-width: ${W}mm !important; }
    /* Some thermal drivers honour an explicit @page inside the print
       media block better than the top-level one. Belt and suspenders. */
    @page { size: ${W}mm auto; margin: 0; }
  }
</style>
</head>
<body>
${parts.join('\n')}
<script>
  // Print as soon as layout settles. Fires once. The onafterprint /
  // timeout closes the tab so the cashier isn't left with a stray
  // window after every bill.
  var done = false;
  function go() {
    if (done) return; done = true;
    try { window.focus(); window.print(); } catch (e) {}
  }
  window.addEventListener('load', function () { setTimeout(go, 250); });
  setTimeout(go, 800);
  window.addEventListener('afterprint', function () { setTimeout(function(){ try { window.close(); } catch(e){} }, 300); });
</script>
</body>
</html>`;
}

// Open the receipt HTML in a new tab and let it self-print. Returns
// { fallback } — 'popup' if the pop-up was blocked (caller can toast).
export function printThermalReceipt(data, widthMm) {
  const html = buildThermalReceiptHtml(data, widthMm);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return { fallback: 'popup' };
  }
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_e) { /* ignore */ } }, 60000);
  return { fallback: null };
}
