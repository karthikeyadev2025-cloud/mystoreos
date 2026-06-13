// UPI deep-link / QR builder.
//
// The hard rule (NPCI + PhonePe/GPay policy): a PERSONAL VPA cannot receive a
// tap/link-initiated payment that carries an amount — apps throw "payment
// through a link not allowed for this merchant". Only a MERCHANT VPA (with a
// merchant code) may carry am=/mc= in an intent.
//
// So:
//  - If the shop has a merchant UPI ID  -> build a full merchant intent
//    (pa, pn, mc, tr, tn, am, cu) that works as a tappable "Pay Now" link.
//  - Otherwise (personal VPA only)      -> build an amount-free string meant to
//    be SCANNED (no am=), which is the only thing personal VPAs reliably allow.

// Returns the best payee for collection: merchant VPA if present, else personal.
export function resolvePayee(shop) {
  const merchant = (shop?.merchantUpiId || '').trim();
  const personal = (shop?.upiId || '').trim();
  if (merchant) return { vpa: merchant, isMerchant: true, mc: (shop?.merchantCode || '').trim() };
  return { vpa: personal, isMerchant: false, mc: '' };
}

// Build a UPI URI.
//   shop    : { upiId, merchantUpiId, merchantCode, name }
//   amount  : number | null  (only embedded for merchant VPAs)
//   txnRef  : string | null  (order/bill id)
//   note    : string | null
// When the payee is a personal VPA, amount is intentionally omitted so the
// string behaves like a normal scan target.
export function buildUpiUri(shop, { amount = null, txnRef = null, note = 'Payment' } = {}) {
  const { vpa, isMerchant, mc } = resolvePayee(shop);
  if (!vpa) return null;
  const params = new URLSearchParams();
  params.set('pa', vpa);
  params.set('pn', shop?.name || 'Merchant');
  if (isMerchant) {
    if (mc) params.set('mc', mc);
    if (txnRef) params.set('tr', String(txnRef).slice(0, 35));
    if (amount != null && Number(amount) > 0) params.set('am', String(amount));
  }
  if (note) params.set('tn', note);
  params.set('cu', 'INR');
  // URLSearchParams encodes spaces as '+'; UPI apps want %20, so normalize.
  return 'upi://pay?' + params.toString().replace(/\+/g, '%20');
}

// True when the shop can offer a tappable "Pay Now" link (merchant VPA set).
export function canTapToPay(shop) {
  return !!(shop?.merchantUpiId || '').trim();
}
