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

// Shared print CSS shell — every template gets the correct @page size
// for the chosen paper (A4 / 80mm / 58mm thermal), matching the
// technique validated in thermalReceipt.js and printPdf.js.
function shell(bodyHtml, { widthMm = 210, extraCss = '' } = {}) {
  const isThermal = widthMm !== 210;
  const pageCss = isThermal
    ? `@page { size: ${widthMm}mm auto; margin: 0; }`
    : `@page { size: A4; margin: 12mm; }`;
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
    width: ${isThermal ? widthMm + 'mm' : '186mm'};
    max-width: ${isThermal ? widthMm + 'mm' : '100%'};
    margin: 0 auto;
    font-size: ${isThermal ? '11px' : '13px'};
  }
  table { border-collapse: collapse; width: 100%; }
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

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${esc(it.code || '')}</td>
      <td style="padding:6px 8px;border:1px solid #333;">${esc(it.name)}</td>
      ${it.boxes != null ? `<td style="padding:6px 8px;border:1px solid #333;text-align:center;">${int(it.boxes)}</td>` : ''}
      <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${int(it.qty)}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:right;">${money(it.rate)}</td>
      <td style="padding:6px 8px;border:1px solid #333;text-align:right;font-weight:600;">${money((Number(it.rate) || 0) * (Number(it.qty) || 0))}</td>
    </tr>`).join('');

  const hasBoxes = items.some(it => it.boxes != null);
  const totalQty = items.reduce((a, i) => a + (Number(i.qty) || 0), 0);

  const body = `
    <div style="padding:${widthMm === 210 ? '0' : '8px'};font-family:'Inter',Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:10px;">
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
            ${hasBoxes ? '<th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Boxes</th>' : ''}
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Qty</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Rate</th>
            <th style="padding:6px 8px;border:1px solid #333;font-size:10px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:800;">
            <td colspan="${hasBoxes ? 4 : 3}" style="padding:6px 8px;border:1px solid #333;text-align:right;">Total:</td>
            <td style="padding:6px 8px;border:1px solid #333;text-align:center;">${int(totalQty)}</td>
            <td style="padding:6px 8px;border:1px solid #333;"></td>
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

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;">${i + 1}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;">${esc(it.name)}</td>
      <td style="padding:6px;border-bottom:1px solid #E2E8F0;text-align:center;">${esc(it.hsn || '-')}</td>
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

const RENDERERS = {
  classic: renderClassic,
  wholesale: renderWholesale,
  gst_tax: renderGstTax,
  minimal: renderMinimal,
  modern: renderModern,
};

// Public entry point. widthMm: 210 (A4) | 80 | 58.
export function renderInvoiceHtml(templateId, data, widthMm = 210) {
  const fn = RENDERERS[templateId] || RENDERERS.classic;
  return fn(data, widthMm);
}
