// Print helper that actually respects thermal-paper dimensions.
//
// Why this exists: jsPDF creates the PDF at the correct thermal width
// (58mm / 80mm) but when Chrome opens the blob in a new tab, its print
// dialog defaults to whatever paper size the printer has selected
// (usually A4) and then scales the receipt to fit. Result: an 80mm
// receipt gets blown up onto A4 with a huge left margin, or a 58mm
// one gets shrunk into a tiny strip in the middle. Neither prints on
// the actual thermal roll.
//
// Fix: two layers.
//   1) doc.autoPrint({variant:'non-conform'}) — embeds a JavaScript
//      action in the PDF so the PDF viewer auto-fires its own print
//      dialog with the document's declared page size. Works in Adobe
//      Reader and Chrome's built-in PDF viewer.
//   2) HTML wrapper with @page CSS — for browsers that ignore #1
//      (Firefox in-tab viewer, some mobile browsers). The wrapper is
//      a minimal HTML page with the PDF embedded and an @page rule
//      that tells the print CSS layer "use thermal dimensions", which
//      the browser's own print dialog then honours as the default.
//
// The combination means "Print" from the tab respects paper size
// without the shop owner having to fiddle with the paper-size dropdown
// on every single print.

export async function printPdfWithFormat(doc, { fileName, format }) {
  // format: 'a4' | 'thermal80' | 'thermal58'
  const isThermal = format === 'thermal80' || format === 'thermal58';
  const paperW    = format === 'thermal58' ? 58 : format === 'thermal80' ? 80 : 210;

  // Layer 1 — try jsPDF's autoPrint. This embeds a PDF JavaScript action
  // that triggers the print dialog when the PDF is opened. The 'non-conform'
  // variant is more widely supported.
  try {
    if (typeof doc.autoPrint === 'function') {
      doc.autoPrint({ variant: 'non-conform' });
    }
  } catch { /* autoPrint isn't fatal — the HTML wrapper still works */ }

  const pdfBlob = doc.output('blob');
  const pdfUrl  = URL.createObjectURL(pdfBlob);

  // Layer 2 — HTML wrapper with @page CSS. Even if the PDF viewer
  // ignores autoPrint, the wrapper's @page rule sets the correct
  // default paper size in the browser's print dialog.
  //
  // We use paper size as CSS ('58mm auto' means 58mm wide, auto-height
  // for whatever length the PDF is). Margin 0 so the receipt starts at
  // the roll edge — jsPDF already baked internal margins into the PDF.
  const pageCss = isThermal
    ? `@page { size: ${paperW}mm auto; margin: 0; }`
    : `@page { size: A4; margin: 0; }`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(fileName)}</title>
  <style>
    ${pageCss}
    html, body { margin: 0; padding: 0; height: 100%; background: #444; }
    embed, iframe { width: 100%; height: 100vh; border: 0; display: block; }
  </style>
</head>
<body>
  <embed id="pdfembed" src="${pdfUrl}" type="application/pdf" />
  <script>
    // Fire the browser's print dialog after the PDF has had a moment
    // to render inside the embed. Guarded to run once even if triggered
    // multiple times (some browsers fire onload late).
    let printed = false;
    function firePrint() {
      if (printed) return; printed = true;
      try { window.focus(); window.print(); } catch (e) {}
    }
    // Both a settled-load listener and a hard delay fallback.
    window.addEventListener('load', () => setTimeout(firePrint, 400));
    setTimeout(firePrint, 1200);
    // Revoke the object URL after print dialog opens.
    setTimeout(() => { try { URL.revokeObjectURL(${JSON.stringify(pdfUrl)}); } catch (e) {} }, 60000);
  </script>
</body>
</html>`;

  const wrapperBlob = new Blob([html], { type: 'text/html' });
  const wrapperUrl  = URL.createObjectURL(wrapperBlob);

  const win = window.open(wrapperUrl, '_blank');
  if (!win) {
    // Pop-up blocked. Fall back to download so the user still gets the file.
    URL.revokeObjectURL(pdfUrl);
    URL.revokeObjectURL(wrapperUrl);
    doc.save(fileName);
    return { fallback: 'download' };
  }

  // Clean up the wrapper URL later (the tab has already loaded from it).
  setTimeout(() => { try { URL.revokeObjectURL(wrapperUrl); } catch (_e) { /* ignore */ } }, 60000);
  return { fallback: null };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
