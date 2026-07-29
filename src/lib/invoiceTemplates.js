// ═══════════════════════════════════════════════════════════════════
// INVOICE TEMPLATES
//
// Five distinct printable invoice layouts. Each is a pure function
// that takes normalized bill data and returns a full HTML document
// string — the same technique already proven for thermal receipts
// (src/lib/thermalReceipt.js): native browser print via @page CSS,
// which renders crisper and more reliably than drawing everything
// by hand in jsPDF.
//
// Templates:
//   'classic'   — clean modern retail invoice (default)
//   'wholesale' — S.No / Code / Item / Qty / Rate / Total ledger-style
//                 quotation sheet, matching a traditional distributor
//                 invoice book (amount in words, T&C, signature line)
//   'gst_tax'   — full GST tax invoice with HSN codes and CGST/SGST
//                 breakdown
//   'minimal'   — ultra-compact, thermal-first, minimum ink
//   'modern'    — logo-forward, colour-accented, brand-first layout
//
// Data shape expected by every renderer (all fields optional unless
// noted — renderers degrade gracefully when a field is missing):
//
//   {
//     shopName, shopPhone, shopAddress, shopGSTIN, logoUrl,
//     billNo, dateStr,
//     customerName, customerPhone, customerAddress,
//     items: [{ code, name, hsn, qty, unit, rate, discountPct, gstPct, total }],
//     subtotal, discountAmount, gstAmount, roundOff, total,
//     paymentMode, footerNote, termsNote,
//   }
// ═══════════════════════════════════════════════════════════════════

import { amountInWordsLine } from './numberToWords';

export const INVOICE_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean, modern retail invoice. Works well for any shop.',
  },
  {
    id: 'wholesale',
    name: 'Wholesale Quotation',
    description: 'Traditional ledger-style sheet with item codes, amount in words, and terms — built for distributor/bulk billing.',
  },
  {
    id: 'gst_tax',
    name: 'GST Tax Invoice',
    description: 'Full tax invoice with HSN codes and CGST/SGST/IGST breakdown.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Compact, ink-light layout. Best for high-volume thermal printing.',
  },
  {
    id: 'modern',
    name: 'Modern Branded',
    description: 'Logo-forward layout with a colour accent — a more premium look for customer-facing bills.',
  },
];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n) => Number(n || 0).toLocaleString('en-IN');

// Shared print CSS shell — supports A4 (210mm), A5 (148mm), 80mm & 58mm thermal,
// Duplicate Copy printing (Original for Recipient + Duplicate for Supplier),
// and CSS page margin resets to prevent browser default URL/date headers & footers from printing.
function shell(bodyHtml, { widthMm = 210, paperFormat = 'a4', isDuplicate = false, extraCss = '' } = {}) {
  const isThermal = widthMm === 58 || widthMm === 80;
  const isA5 = paperFormat === 'a5' || widthMm === 148;

  let pageCss = `@page { size: A4; margin: 8mm; }`;
  if (isA5) {
    pageCss = `@page { size: A5; margin: 6mm; }`;
  } else if (isThermal) {
    pageCss = `@page { size: ${widthMm}mm auto; margin: 0; }`;
  }

  const printBodyWidth = isThermal ? `${widthMm}mm` : (isA5 ? '134mm' : '194mm');

  // If duplicate printing is enabled, render Original Copy + Duplicate Copy
  let content = bodyHtml;
  if (isDuplicate && !isThermal) {
    content = `
      <div class="invoice-copy original-copy">
        <div style="background:#0F172A;color:#FFF;font-size:10px;font-weight:800;letter-spacing:1px;text-align:center;padding:3px;text-transform:uppercase;margin-bottom:8px;border-radius:4px;">
          ORIGINAL FOR RECIPIENT
        </div>
        ${bodyHtml}
      </div>
      <div style="page-break-before: always; margin-top: 15px;" class="invoice-copy duplicate-copy">
        <div style="background:#334155;color:#FFF;font-size:10px;font-weight:800;letter-spacing:1px;text-align:center;padding:3px;text-transform:uppercase;margin-bottom:8px;border-radius:4px;">
          DUPLICATE FOR SUPPLIER / TRANSPORTER
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${pageCss}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: #0F172A;
    width: ${printBodyWidth};
    max-width: 100%;
    margin: 0 auto;
    font-size: ${isThermal ? '11px' : (isA5 ? '11.5px' : '13px')};
  }
  table { border-collapse: collapse; width: 100%; }
  
  /* Suppress default browser header/footer URLs & dates on print */
  @media print {
    @page {
      margin: ${isThermal ? '0' : (isA5 ? '6mm' : '8mm')};
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
    }
  }
  ${extraCss}
</style>
</head>
<body>
${bodyHtml}
<script>
  window.addEventListener('load', () => setTimeout(() => window.print(), 300));
  setTimeout(() => window.print(), 900);
</script>
</body>
</html>`;
}

function computeTotals(data) {
  const items = data.items || [];
  const subtotal = data.subtotal ?? items.reduce((a, i) => a + (Number(i.rate) || 0) * (Number(i.qty) || 0), 0);
  const total = data.total ?? subtotal;
  return { subtotal, total };
}

// ─── CLASSIC ──────────────────────────────────────────────────────
function renderClassic(data, widthMm) {
  const { subtotal, total } = computeTotals(data);
  const rows = (data.items || []).map((it, i) => `
    <tr>
      <td style="padding:7px 6px;border-bottom:1px solid #EEF0F3;">${i + 1}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #EEF0F3;">${esc(it.name)}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #EEF0F3;text-align:center;">${int(it.qty)}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #EEF0F3;text-align:right;">${money(it.rate)}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #EEF0F3;text-align:right;font-weight:600;">${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</td>
    </tr>`).join('');

  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '10px 8px'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F172A;padding-bottom:14px;margin-bottom:16px;">
        <div>
          <div style="font-size:19px;font-weight:800;">${esc(data.shopName || 'Shop')}</div>
          ${data.shopAddress ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">${esc(data.shopAddress)}</div>` : ''}
          ${data.shopPhone ? `<div style="font-size:11px;color:#64748B;">${esc(data.shopPhone)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;">Invoice</div>
          <div style="font-size:14px;font-weight:700;">${esc(data.billNo || '')}</div>
          <div style="font-size:11px;color:#64748B;">${esc(data.dateStr || '')}</div>
        </div>
      </div>
      ${data.customerName ? `<div style="margin-bottom:14px;font-size:12px;"><b>Bill to:</b> ${esc(data.customerName)} ${data.customerPhone ? `· ${esc(data.customerPhone)}` : ''}</div>` : ''}
      <table>
        <thead><tr style="background:#F8FAFC;">
          <th style="padding:7px 6px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748B;">#</th>
          <th style="padding:7px 6px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748B;">Item</th>
          <th style="padding:7px 6px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748B;">Qty</th>
          <th style="padding:7px 6px;text-align:right;font-size:10px;text-transform:uppercase;color:#64748B;">Rate</th>
          <th style="padding:7px 6px;text-align:right;font-size:10px;text-transform:uppercase;color:#64748B;">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div style="width:220px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B;"><span>Subtotal</span><span>₹${money(subtotal)}</span></div>
          ${data.discountAmount ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#DC2626;"><span>Discount</span><span>-₹${money(data.discountAmount)}</span></div>` : ''}
          ${data.roundOff ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B;"><span>Round off</span><span>${data.roundOff > 0 ? '+' : ''}₹${money(data.roundOff)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:6px;border-top:2px solid #0F172A;font-size:16px;font-weight:800;"><span>Total</span><span>₹${money(total)}</span></div>
        </div>
      </div>
      ${data.paymentMode ? `<div style="margin-top:14px;font-size:11px;color:#64748B;">Payment: ${esc(data.paymentMode)}</div>` : ''}
      ${data.footerNote ? `<div style="margin-top:20px;text-align:center;font-size:11px;color:#94A3B8;">${esc(data.footerNote)}</div>` : ''}
    </div>`;
  return shell(body, { widthMm });
}

// ─── WHOLESALE QUOTATION ────────────────────────────────────────
// Matches the traditional distributor invoice book format: S.No /
// Code / Item Name / Qty / Rate / Total columns, boxed header, amount
// in words, numbered terms & conditions, signature line.
function renderWholesale(data, widthMm) {
  const { subtotal, total } = computeTotals(data);
  const items = data.items || [];

  // Jars/Boxes columns — matches the client's real printed invoice
  // format exactly: Jars = units per box (a product spec), Boxes =
  // how many boxes were ordered, Qty = Jars × Boxes = total individual
  // units actually billed. Only shown when at least one item actually
  // uses box-based ordering — a plain per-piece item just shows Qty.
  const hasJarsBoxes = items.some(it => it.jars != null && it.boxes != null);
  // HSN — shown as simple reference info (not a GST-inclusive total
  // calculation, which stays exclusive to the dedicated gst_tax
  // template) since the client's real invoice format has no GST
  // breakdown at all, just a Rate column.
  const hasHsn = items.some(it => it.hsn);

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${esc(it.code || '')}</td>
      <td style="padding:6px 8px;border:1px solid #333;">${esc(it.name)}</td>
      ${hasHsn ? `<td style="padding:6px 8px;border:1px solid #333;text-align:center;">${esc(it.hsn || '')}</td>` : ''}
      ${hasJarsBoxes ? `<td style="padding:6px 8px;border:1px solid #333;text-align:center;">${it.jars != null ? int(it.jars) : ''}</td>` : ''}
      ${hasJarsBoxes ? `<td style="padding:6px 8px;border:1px solid #333;text-align:center;">${it.boxes != null ? int(it.boxes) : ''}</td>` : ''}
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${int(it.qty)}${it.unit ? ` ${esc(it.unit)}` : ''}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:right;">${money(it.rate)}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:right;font-weight:600;">${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</td>
    </tr>`).join('');

  const totalBoxes = items.reduce((a, i) => a + (Number(i.boxes) || 0), 0);
  const colsBeforeQty = 3 + (hasHsn ? 1 : 0) + (hasJarsBoxes ? 2 : 0);

  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '8px'};font-family:'Inter',Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:10px;">
        ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin-bottom:6px;" />` : ''}
        <div style="font-size:20px;font-weight:800;letter-spacing:0.02em;">${esc(data.shopName || 'Shop')}</div>
        ${data.shopAddress ? `<div style="font-size:11px;color:#333;margin-top:2px;">${esc(data.shopAddress)}</div>` : ''}
        ${data.shopPhone ? `<div style="font-size:11px;color:#333;">${esc(data.shopPhone)}</div>` : ''}
        ${data.shopGSTIN ? `<div style="font-size:11px;color:#333;font-weight:600;">GSTIN: ${esc(data.shopGSTIN)}</div>` : ''}
      </div>

      <div style="border:1.5px solid #333;padding:0;margin-bottom:0;">
        <div style="text-align:center;font-size:15px;font-weight:800;letter-spacing:0.08em;padding:6px;border-bottom:1.5px solid #333;">${esc((data.modeTitle || 'QUOTATION').toUpperCase())}</div>
        <table style="width:100%;">
          <tr>
            <td style="width:55%;padding:8px 10px;vertical-align:top;border-right:1px solid #333;">
              ${data.customerName ? `<div style="font-weight:700;font-size:13px;">${esc(data.customerName)}</div>` : ''}
              ${data.customerAddress ? `<div style="font-size:11px;margin-top:2px;">${esc(data.customerAddress)}</div>` : ''}
              ${data.customerPhone ? `<div style="font-size:11px;">${esc(data.customerPhone)}</div>` : ''}
            </td>
            <td style="padding:8px 10px;font-size:11px;">
              <div><b>Invoice Date</b>&nbsp; ${esc(data.dateStr || '')}</div>
              <div><b>Invoice No.</b>&nbsp; ${esc(data.billNo || '')}</div>
              <div><b>Transport</b>&nbsp; ${esc(data.transportName || '')}</div>
              <div><b>L.R No.</b>&nbsp; ${esc(data.lrNo || '')}</div>
            </td>
          </tr>
        </table>
      </div>

      <table style="margin-top:-1px;">
        <thead>
          <tr style="background:#F1F1F1;">
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">S.No</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Code</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;text-align:left;">Item Name</th>
            ${hasHsn ? '<th style="padding:6px 8px;border:1px solid #333;font-size:10px;">HSN</th>' : ''}
            ${hasJarsBoxes ? '<th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Jars</th>' : ''}
            ${hasJarsBoxes ? '<th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Boxes</th>' : ''}
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Qty</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Rate</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:800;">
            <td colspan="${hasJarsBoxes ? colsBeforeQty - 1 : colsBeforeQty + 2}" style="padding:6px 8px;border:1px solid #333;text-align:right;">Total:</td>
            ${hasJarsBoxes ? `<td style="padding:6px 8px;border:1px solid #333;text-align:center;">${int(totalBoxes)}</td><td colspan="2" style="padding:6px 8px;border:1px solid #333;"></td>` : ''}
            <td style="padding:6px 8px;border:1px solid #333;text-align:right;">${money(total)}</td>
          </tr>
        </tfoot>
      </table>

      <table style="margin-top:-1px;">
        <tr>
          <td style="width:60%;border:1px solid #333;padding:8px 10px;vertical-align:top;">
            <div style="font-size:10px;text-transform:uppercase;color:#555;font-weight:700;">Total amount in words</div>
            <div style="font-size:12px;margin-top:3px;">${esc(amountInWordsLine(total))}</div>
          </td>
          <td style="border:1px solid #333;padding:8px 10px;text-align:right;vertical-align:top;">
            <div style="font-size:10px;text-transform:uppercase;color:#555;font-weight:700;">Net Amount</div>
            <div style="font-size:18px;font-weight:800;margin-top:3px;">${money(total)}</div>
          </td>
        </tr>
      </table>

      <div style="margin-top:14px;font-size:10px;color:#333;line-height:1.6;">
        ${data.termsNote ? esc(data.termsNote) : `
        1. Goods once sold will not be taken back.<br/>
        2. Interest at 24% will be charged if not paid within 15 days.<br/>
        3. Subject to local jurisdiction only.`}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:36px;">
        <div style="font-size:10px;color:#555;">E.&amp;O.E.</div>
        <div style="text-align:center;">
          <div style="border-top:1px solid #333;padding-top:4px;font-size:11px;width:160px;">Authorised Signatory</div>
        </div>
      </div>

      <div style="text-align:center;margin-top:16px;font-size:11px;font-weight:600;letter-spacing:0.02em;">
        THANKING YOU FOR SHOPPING &amp; VISIT AGAIN
      </div>
    </div>`;
  return shell(body, { widthMm, extraCss: `td, th { font-family: 'Inter', Arial, sans-serif; }` });
}

// ─── GST TAX INVOICE ──────────────────────────────────────────────
function renderGstTax(data, widthMm) {
  const items = data.items || [];
  const { subtotal, total } = computeTotals(data);
  const gstAmount = data.gstAmount ?? items.reduce((a, i) => {
    const line = (Number(i.rate) || 0) * (Number(i.qty) || 0);
    return a + line * ((Number(i.gstPct) || 0) / 100);
  }, 0);
  const cgst = gstAmount / 2, sgst = gstAmount / 2;

  // Jars/Boxes, same as the wholesale template. An FMCG distributor
  // reads their invoice in boxes, not loose units — having a GSTIN
  // shouldn't cost them the format they actually work in. Only shown
  // when a line genuinely has a pack size.
  const hasJarsBoxes = items.some(it => it.jars != null && it.boxes != null);

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;">${i + 1}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;">${esc(it.name)}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${esc(it.hsn || '-')}</td>
      ${hasJarsBoxes ? `<td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${it.jars != null ? int(it.jars) : ''}</td>` : ''}
      ${hasJarsBoxes ? `<td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${it.boxes != null ? int(it.boxes) : ''}</td>` : ''}
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${int(it.qty)}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:right;">${money(it.rate)}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${it.gstPct || 0}%</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:600;">${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</td>
    </tr>`).join('');

  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '8px'};">
      <div style="text-align:center;border-bottom:2px solid #0F172A;padding-bottom:10px;margin-bottom:14px;">
        <div style="font-size:19px;font-weight:800;">${esc(data.shopName || 'Shop')}</div>
        ${data.shopAddress ? `<div style="font-size:11px;color:#64748B;">${esc(data.shopAddress)}</div>` : ''}
        ${data.shopGSTIN ? `<div style="font-size:11px;color:#64748B;">GSTIN: ${esc(data.shopGSTIN)}</div>` : ''}
        <div style="font-size:13px;font-weight:700;margin-top:6px;letter-spacing:0.06em;">TAX INVOICE</div>
      </div>
      <table style="margin-bottom:12px;"><tr>
        <td style="font-size:11px;"><b>Invoice No:</b> ${esc(data.billNo || '')}<br/><b>Date:</b> ${esc(data.dateStr || '')}</td>
        <td style="font-size:11px;text-align:right;">${data.customerName ? `<b>Bill to:</b> ${esc(data.customerName)}<br/>${esc(data.customerPhone || '')}` : ''}</td>
      </tr></table>
      <table>
        <thead><tr style="background:#F8FAFC;">
          <th style="padding:6px;text-align:left;font-size:9.5px;color:#64748B;">#</th>
          <th style="padding:6px;text-align:left;font-size:9.5px;color:#64748B;">Item</th>
          <th style="padding:6px;text-align:center;font-size:9.5px;color:#64748B;">HSN</th>
          ${hasJarsBoxes ? '<th style="padding:6px;text-align:center;font-size:9.5px;color:#64748B;">Jars</th>' : ''}
          ${hasJarsBoxes ? '<th style="padding:6px;text-align:center;font-size:9.5px;color:#64748B;">Boxes</th>' : ''}
          <th style="padding:6px;text-align:center;font-size:9.5px;color:#64748B;">Qty</th>
          <th style="padding:6px;text-align:right;font-size:9.5px;color:#64748B;">Rate</th>
          <th style="padding:6px;text-align:center;font-size:9.5px;color:#64748B;">GST</th>
          <th style="padding:6px;text-align:right;font-size:9.5px;color:#64748B;">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <div style="width:240px;">
          <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span>Taxable value</span><span>₹${money(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span>CGST</span><span>₹${money(cgst)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span>SGST</span><span>₹${money(sgst)}</span></div>
          ${data.roundOff ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span>Round off</span><span>${data.roundOff > 0 ? '+' : ''}₹${money(data.roundOff)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:6px;border-top:2px solid #0F172A;font-size:15px;font-weight:800;"><span>Total</span><span>₹${money(total)}</span></div>
        </div>
      </div>
      <div style="margin-top:14px;font-size:11px;">${esc(amountInWordsLine(total))}</div>
      <div style="margin-top:24px;font-size:10px;color:#94A3B8;text-align:center;">Computer-generated invoice. No signature required.</div>
    </div>`;
  return shell(body, { widthMm });
}

// ─── MINIMAL ──────────────────────────────────────────────────────
function renderMinimal(data, widthMm) {
  const { total } = computeTotals(data);
  const items = data.items || [];
  const rows = items.map(it => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;">
      <span>${esc(it.name)} x${int(it.qty)}</span>
      <span>${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</span>
    </div>`).join('');
  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '6px'};">
      <div style="text-align:center;font-weight:800;font-size:14px;">${esc(data.shopName || 'Shop')}</div>
      <div style="text-align:center;font-size:10px;color:#64748B;">${esc(data.dateStr || '')} · ${esc(data.billNo || '')}</div>
      <div style="border-top:1px dashed #999;margin:8px 0;"></div>
      ${rows}
      <div style="border-top:1px dashed #999;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;"><span>TOTAL</span><span>₹${money(total)}</span></div>
      ${data.footerNote ? `<div style="text-align:center;margin-top:10px;font-size:10px;color:#94A3B8;">${esc(data.footerNote)}</div>` : ''}
    </div>`;
  return shell(body, { widthMm });
}

// ─── MODERN BRANDED ───────────────────────────────────────────────
function renderModern(data, widthMm) {
  const { subtotal, total } = computeTotals(data);
  const items = data.items || [];
  const accent = data.accentColor || '#4F46E5';
  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:8px 6px;${i % 2 ? `background:${accent}08;` : ''}">${esc(it.name)}</td>
      <td style="padding:8px 6px;text-align:center;${i % 2 ? `background:${accent}08;` : ''}">${int(it.qty)}</td>
      <td style="padding:8px 6px;text-align:right;${i % 2 ? `background:${accent}08;` : ''}">${money(it.rate)}</td>
      <td style="padding:8px 6px;text-align:right;font-weight:700;${i % 2 ? `background:${accent}08;` : ''}">${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</td>
    </tr>`).join('');

  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '8px'};">
      <div style="background:${accent};color:#fff;padding:18px 20px;border-radius:${widthMm === 210 ? '10px' : '0'};margin-bottom:16px;">
        <div style="font-size:20px;font-weight:800;">${esc(data.shopName || 'Shop')}</div>
        ${data.shopPhone ? `<div style="font-size:11px;opacity:0.85;margin-top:2px;">${esc(data.shopPhone)}</div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:11px;opacity:0.9;">
          <span>${esc(data.billNo || '')}</span><span>${esc(data.dateStr || '')}</span>
        </div>
      </div>
      ${data.customerName ? `<div style="margin-bottom:12px;font-size:12px;"><b>For:</b> ${esc(data.customerName)}</div>` : ''}
      <table>
        <thead><tr>
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:${accent};border-bottom:2px solid ${accent};">Item</th>
          <th style="padding:8px 6px;text-align:center;font-size:10px;color:${accent};border-bottom:2px solid ${accent};">Qty</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${accent};border-bottom:2px solid ${accent};">Rate</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${accent};border-bottom:2px solid ${accent};">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div style="width:220px;background:${accent}0D;border-radius:8px;padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;"><span>Subtotal</span><span>₹${money(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:17px;font-weight:800;color:${accent};"><span>Total</span><span>₹${money(total)}</span></div>
        </div>
      </div>
      ${data.footerNote ? `<div style="text-align:center;margin-top:20px;font-size:11px;color:#94A3B8;">${esc(data.footerNote)}</div>` : ''}
    </div>`;
  return shell(body, { widthMm });
}

// ─── PRODUCT CATALOG ──────────────────────────────────────────────
// A completely different kind of document from every invoice template
// above — a shareable brochure/catalog for a distributor's wholesale
// products, not a billing document for one specific transaction.
// Registered as a template type so it reuses the exact same proven
// print/PDF infrastructure (printInvoice / buildInvoicePdfBlob) rather
// than building a second, separate rendering pipeline.
//
// data shape:
//   distributorName, distributorPhone, distributorAddress, logoUrl,
//   generatedDate,
//   products: [{ name, category, unit, packSize, price, sku }]
function renderCatalog(data, widthMm) {
  const products = data.products || [];

  // Group by category, keeping an "Other" bucket for anything
  // uncategorized rather than dropping those products silently.
  const groups = {};
  products.forEach(p => {
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  const categoryNames = Object.keys(groups).sort((a, b) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b));

  const unitLabel = (p) => {
    if (p.packSize && p.unit) return `₹${money(p.price)} / ${esc(p.unit)} (${int(p.packSize)}/box)`;
    if (p.unit) return `₹${money(p.price)} / ${esc(p.unit)}`;
    return `₹${money(p.price)}`;
  };

  const sections = categoryNames.map(cat => `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:#4F46E5;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #4F46E5;padding-bottom:6px;margin-bottom:12px;">${esc(cat)}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        ${groups[cat].map(p => `
          <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;background:#FAFBFC;display:flex;gap:12px;align-items:center;">
            ${p.image ? `<img src="${esc(p.image)}" alt="" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #E2E8F0;" />` : ''}
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:4px;">${esc(p.name)}</div>
              ${p.sku ? `<div style="font-size:10px;color:#94A3B8;margin-bottom:4px;">Code: ${esc(p.sku)}</div>` : ''}
              <div style="font-size:14px;font-weight:800;color:#059669;">${unitLabel(p)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Wholesale Catalog</title></head>
<body style="margin:0;font-family:'Inter',Arial,sans-serif;background:#fff;">
  <div style="max-width:${widthMm === 210 ? '760px' : '480px'};margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #4F46E5;">
      ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;" />` : ''}
      <div style="font-size:26px;font-weight:900;color:#0F172A;letter-spacing:-0.02em;">${esc(data.distributorName || 'Wholesale Distributor')}</div>
      <div style="font-size:13px;font-weight:700;color:#4F46E5;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Wholesale Product Catalog</div>
      ${data.distributorAddress ? `<div style="font-size:12px;color:#64748B;margin-top:8px;">${esc(data.distributorAddress)}</div>` : ''}
      ${data.distributorPhone ? `<div style="font-size:12px;color:#64748B;">📞 ${esc(data.distributorPhone)}</div>` : ''}
    </div>

    ${products.length === 0
      ? '<p style="text-align:center;color:#94A3B8;padding:40px 0;">No products published yet.</p>'
      : sections}

    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:11px;">
      Generated ${esc(data.generatedDate || '')} · Contact us to place your order
    </div>
  </div>
</body></html>`;
}

function renderPartyStatement(data, widthMm = 210) {
  const isThermal = widthMm !== 210;
  const txs = data.transactions || [];
  const rowsHtml = txs.map(t => `
    <tr style="border-bottom:1px solid #E2E8F0;">
      <td style="padding:8px 10px;font-size:12px;color:#334155;">${esc(t.date)}</td>
      <td style="padding:8px 10px;font-size:12px;font-family:monospace;color:#475569;">${esc(t.refNo || '-')}</td>
      <td style="padding:8px 10px;font-size:12px;"><span style="background:${t.type === 'Payment' || t.type === 'Credit Note' ? '#DCFCE7' : '#EEF2FF'};color:${t.type === 'Payment' || t.type === 'Credit Note' ? '#15803D' : '#4F46E5'};padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;">${esc(t.type)}</span></td>
      <td style="padding:8px 10px;font-size:12px;color:#0F172A;">${esc(t.description)}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:right;color:#0F172A;font-weight:600;">${t.debit ? '₹' + money(t.debit) : '-'}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:right;color:#059669;font-weight:600;">${t.credit ? '₹' + money(t.credit) : '-'}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:800;color:${t.balance > 0 ? '#DC2626' : '#059669'};">₹${money(t.balance)}</td>
    </tr>
  `).join('');

  return shell(`
    <div style="padding:${isThermal ? '10px' : '20px'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F172A;padding-bottom:16px;margin-bottom:20px;">
        <div>
          ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" alt="" style="height:48px;margin-bottom:8px;" />` : ''}
          <div style="font-size:20px;font-weight:900;color:#0F172A;letter-spacing:-0.01em;">${esc(data.distributorName || 'Distributor')}</div>
          ${data.distributorAddress ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">${esc(data.distributorAddress)}</div>` : ''}
          ${data.distributorPhone ? `<div style="font-size:11px;color:#64748B;">Phone: ${esc(data.distributorPhone)}</div>` : ''}
          ${data.distributorGSTIN ? `<div style="font-size:11px;font-weight:700;color:#475569;">GSTIN: ${esc(data.distributorGSTIN)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:900;color:#4F46E5;text-transform:uppercase;letter-spacing:0.05em;">Party Ledger Statement</div>
          <div style="font-size:11px;color:#64748B;margin-top:4px;">Date Generated: ${esc(data.statementDate)}</div>
        </div>
      </div>

      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;text-transform:uppercase;font-weight:800;color:#64748B;letter-spacing:0.05em;">Statement For (Retailer / Party)</div>
          <div style="font-size:16px;font-weight:800;color:#0F172A;margin-top:2px;">${esc(data.partyName)}</div>
          ${data.partyPhone ? `<div style="font-size:11px;color:#64748B;">Phone: ${esc(data.partyPhone)}</div>` : ''}
          ${data.partyAddress ? `<div style="font-size:11px;color:#64748B;">${esc(data.partyAddress)}</div>` : ''}
        </div>
        <div style="display:flex;gap:20px;text-align:right;">
          <div>
            <div style="font-size:10px;color:#64748B;font-weight:700;">TOTAL BILLED</div>
            <div style="font-size:14px;font-weight:800;color:#0F172A;">₹${money(data.totalBilled)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748B;font-weight:700;">TOTAL RECEIVED</div>
            <div style="font-size:14px;font-weight:800;color:#059669;">₹${money(data.totalPaid)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748B;font-weight:700;">NET DUE</div>
            <div style="font-size:16px;font-weight:900;color:${data.closingBalance > 0 ? '#DC2626' : '#059669'};">₹${money(data.closingBalance)}</div>
          </div>
        </div>
      </div>

      <table style="width:100%;margin-bottom:24px;">
        <thead>
          <tr style="background:#F1F5F9;border-top:1px solid #CBD5E1;border-bottom:2px solid #CBD5E1;text-align:left;">
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;">DATE</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;">REF NO</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;">TYPE</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;">PARTICULARS</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;text-align:right;">DEBIT (₹)</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;text-align:right;">CREDIT (₹)</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:800;color:#475569;text-align:right;">BALANCE (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${txs.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94A3B8;">No transactions found for this party.</td></tr>' : rowsHtml}
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;padding-top:16px;border-top:1px solid #E2E8F0;">
        <div style="font-size:11px;color:#94A3B8;">This is a computer-generated statement of accounts.</div>
        <div style="text-align:center;width:180px;">
          <div style="border-bottom:1px solid #94A3B8;height:35px;margin-bottom:4px;"></div>
          <div style="font-size:11px;font-weight:700;color:#475569;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `, { widthMm });
}

const RENDERERS = {
  classic: renderClassic,
  wholesale: renderWholesale,
  gst_tax: renderGstTax,
  minimal: renderMinimal,
  modern: renderModern,
  catalog: renderCatalog,
  party_statement: renderPartyStatement,
};

// Public entry point. widthMm: 210 (A4) | 148 (A5) | 80 | 58.
export function renderInvoiceHtml(templateId, data, widthMm = 210, options = {}) {
  const fn = RENDERERS[templateId] || RENDERERS.classic;
  return fn(data, widthMm, options);
}

