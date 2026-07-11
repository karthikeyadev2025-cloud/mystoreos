// Converts a rupee amount to words using the Indian numbering system
// (Lakh / Crore, not Million / Billion) — matches how every printed
// Indian invoice states "Rupees X Thousand Y Hundred Z Only".
//
// Used by the wholesale/quotation-style invoice template, and available
// to any other template that wants an amount-in-words line.

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n) {
  const h = Math.floor(n / 100), rest = n % 100;
  let out = '';
  if (h) out += ONES[h] + ' Hundred';
  if (rest) out += (out ? ' ' : '') + twoDigits(rest);
  return out;
}

export function numberToWordsIndian(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numberToWordsIndian(-n);

  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ').trim();
}

// Full line as it appears on the invoice — "Rupees X Only"
export function amountInWordsLine(amount) {
  const paise = Math.round((Number(amount) - Math.floor(Number(amount))) * 100);
  const rupees = Math.floor(Number(amount) || 0);
  let out = `Rupees ${numberToWordsIndian(rupees)}`;
  if (paise > 0) out += ` and ${numberToWordsIndian(paise)} Paise`;
  return out + ' Only';
}
