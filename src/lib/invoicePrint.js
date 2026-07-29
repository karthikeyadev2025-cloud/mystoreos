// Print & share dispatcher for the invoice template system.
//
// Two output paths from the same HTML template:
//   printInvoice()  — opens the template HTML in a new tab and fires
//                      window.print(), same technique already proven
//                      for thermal receipts (crisp vector text,
//                      correct @page paper size).
//   shareInvoicePdf() — rasterizes the same HTML (via html2canvas) into
//                      a jsPDF document for WhatsApp share / download /
//                      native mobile share sheet. Keeps every template's
//                      exact layout even though jsPDF itself can't draw
//                      arbitrary HTML.

import html2canvas from 'html2canvas';
import { jsPDF as JsPDF } from 'jspdf';
import { renderInvoiceHtml } from './invoiceTemplates';

function widthMmFor(paperFormat) {
  if (paperFormat === 'thermal58') return 58;
  if (paperFormat === 'thermal80') return 80;
  if (paperFormat === 'a5') return 148;
  return 210; // a4
}

// Print — opens a new tab and triggers the browser print dialog with
// the correct paper size pre-set via @page CSS (A4, A5, Thermal 80mm/58mm).
export function printInvoice(templateId, data, paperFormat = 'a4', options = {}) {
  const widthMm = widthMmFor(paperFormat);
  const isDuplicate = options.isDuplicate || options.duplicate || data.isDuplicate || data.duplicate || false;
  const html = renderInvoiceHtml(templateId, data, widthMm, { paperFormat, isDuplicate, ...options });
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return { opened: false };
  }
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }, 60000);
  return { opened: true };
}

// Share — rasterizes the template to a PDF blob. Renders the HTML
// off-screen in a hidden iframe (isolated styles, no interference with
// the live app), captures it with html2canvas, and paginates the
// resulting image into a jsPDF document sized to match the paper format.
export async function buildInvoicePdfBlob(templateId, data, paperFormat = 'a4') {
  const widthMm = widthMmFor(paperFormat);
  const html = renderInvoiceHtml(templateId, data, widthMm);

  // Render off-screen in a hidden iframe so the template's own CSS
  // (which assumes it owns the whole page) doesn't clash with the
  // app's styles.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = widthMm === 210 ? '800px' : `${widthMm * 3.78}px`; // mm→px @ ~96dpi*fudge
  iframe.style.height = '10px'; // grows after content loads
  document.body.appendChild(iframe);

  try {
    await new Promise((resolve) => {
      iframe.onload = resolve;
      iframe.srcdoc = html;
    });
    // Let web fonts / layout settle.
    await new Promise((r) => setTimeout(r, 150));

    const doc = iframe.contentDocument;
    const body = doc.body;
    // Strip the auto-print script — we don't want the hidden iframe
    // trying to print itself.
    doc.querySelectorAll('script').forEach((s) => s.remove());

    const fullHeightPx = body.scrollHeight;
    iframe.style.height = `${fullHeightPx}px`;

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: body.scrollWidth,
      windowHeight: fullHeightPx,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pxToMm = widthMm / canvas.width;
    const contentHeightMm = canvas.height * pxToMm;

    let pdfDoc;
    if (widthMm === 210) {
      // A4 — paginate if content is taller than one page.
      pdfDoc = new JsPDF({ unit: 'mm', format: 'a4' });
      const pageHeightMm = 297;
      let heightLeft = contentHeightMm;
      let position = 0;
      pdfDoc.addImage(imgData, 'JPEG', 0, position, widthMm, contentHeightMm);
      heightLeft -= pageHeightMm;
      while (heightLeft > 0) {
        position = heightLeft - contentHeightMm;
        pdfDoc.addPage();
        pdfDoc.addImage(imgData, 'JPEG', 0, position, widthMm, contentHeightMm);
        heightLeft -= pageHeightMm;
      }
    } else {
      // Thermal — single tall page sized exactly to the content.
      pdfDoc = new JsPDF({ unit: 'mm', format: [widthMm, Math.max(contentHeightMm, 40)] });
      pdfDoc.addImage(imgData, 'JPEG', 0, 0, widthMm, contentHeightMm);
    }

    return pdfDoc.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}
