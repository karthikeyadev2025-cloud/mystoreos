// jsPDF is dynamically imported so the ~151 KB chunk loads only on first PDF generation
async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

const hex2rgb = (hex) => [
  parseInt(hex.substring(1, 3), 16),
  parseInt(hex.substring(3, 5), 16),
  parseInt(hex.substring(5, 7), 16),
];

// Shared header used by both the Credit Note and Voucher PDFs.
// `opts.showLogo` mirrors the shop's Print Settings toggle (printShowLogo)
// so vouchers/credit notes stay consistent with the main bill PDF instead
// of always forcing the logo on regardless of that setting.
//
// Returns the y-coordinate where the caller should start drawing content —
// this fixes the old bug where the divider line and GSTIN/address block
// used hardcoded y positions that could overlap the shop name/phone/UPI
// block whenever it grew taller than expected (e.g. shop has both a long
// phone number and a UPI ID).
const drawHeader = (doc, shop, title, themeColor, opts = {}) => {
  const showLogo = opts.showLogo !== false; // default true if not specified
  const [tR, tG, tB] = hex2rgb(themeColor);

  doc.setFillColor(tR, tG, tB);
  doc.rect(0, 0, 210, 8, 'F');

  const hasLogo = showLogo && shop.logo && shop.logo.startsWith('data:image');
  if (hasLogo) {
    try { doc.addImage(shop.logo, 'JPEG', 15, 12, 22, 22); } catch (_logoErr) { /* unsupported format */ }
  }

  let hy = 20;
  const textX = hasLogo ? 42 : 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(shop.name || 'Shop', textX, hy);
  hy += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let contactLine = `Phone: ${shop.phone || ''}`;
  if (shop.upiId) contactLine += `   |   UPI: ${shop.upiId}`;
  doc.text(contactLine, textX, hy);
  hy += 5;

  if (shop.gstin) {
    doc.text(`GSTIN: ${shop.gstin}   |   State Code: ${shop.stateCode || ''}`, textX, hy);
    hy += 5;
  }
  if (shop.businessAddress) {
    doc.setFontSize(8.5);
    doc.text(shop.businessAddress, textX, hy, { maxWidth: 150 });
    doc.setFontSize(9);
    hy += 5;
  }

  // Document badge — top right, same row as shop name
  doc.setFillColor(tR, tG, tB);
  doc.roundedRect(135, 12, 60, 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 165, 20.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const dateStr = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Date: ${dateStr}`, 195, 30, { align: 'right' });

  // Divider drawn AFTER all header content is measured, so it never
  // overlaps the shop info block above it regardless of how tall it grew.
  hy = Math.max(hy, hasLogo ? 36 : 32) + 4;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(15, hy, 195, hy);
  hy += 8;

  doc.setTextColor(15, 23, 42);
  return hy; // caller continues drawing content from here
};

// Shared footer — keeps every generated document consistent with the main
// bill PDF: exchange/return policy, terms & conditions (if the shop has
// set them in Settings), and MyStore OS branding.
const drawFooter = (doc, shop, yStart) => {
  let y = Math.max(yStart, 260);

  if (shop.exchangePolicy) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Exchange/Return Policy:', 15, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    doc.text(shop.exchangePolicy, 15, y, { maxWidth: 180 });
    y += 6;
  }
  if (shop.termsConditions) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Terms & Conditions:', 15, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    doc.text(shop.termsConditions, 15, y, { maxWidth: 180 });
    y += 6;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Powered by MyStore OS — mystoreos.in', 15, 287);
};

export const generateVoucherPDF = async (transaction, shop, isReceipt = true) => {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF();
  const themeColor = isReceipt ? '#10b981' : '#ef4444';
  const title = isReceipt ? 'RECEIPT' : 'PAYMENT';

  let yOffset = drawHeader(doc, shop, title, themeColor, { showLogo: shop.printShowLogo });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER', 15, yOffset);
  yOffset += 9;

  doc.setFillColor(248, 250, 252);
  const partyBlockH = 6 + (transaction.partyPhone ? 5 : 0) + (transaction.partyDesc ? 5 : 0) + 4;
  doc.rect(15, yOffset - 4, 120, partyBlockH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isReceipt ? 'RECEIVED FROM:' : 'PAID TO:', 18, yOffset);
  yOffset += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(transaction.partyName || 'Customer/Supplier', 18, yOffset);
  yOffset += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (transaction.partyPhone) { doc.text(`Phone: ${transaction.partyPhone}`, 18, yOffset); yOffset += 5; }
  if (transaction.partyDesc) { doc.text(`Reference: ${transaction.partyDesc}`, 18, yOffset); yOffset += 5; }
  yOffset += 8;

  doc.setFillColor(248, 250, 252);
  doc.rect(15, yOffset, 180, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Description', 18, yOffset + 6);
  doc.text('Amount (Rs)', 165, yOffset + 6);
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 210, 220);
  doc.line(15, yOffset + 9, 195, yOffset + 9);

  yOffset += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    isReceipt
      ? 'Received Cash / UPI payment against outstanding balance'
      : 'Paid Cash / UPI payment against outstanding balance',
    18, yOffset,
  );
  doc.text(Number(transaction.amount).toFixed(2), 165, yOffset);

  yOffset += 10;
  doc.setLineWidth(0.3);
  doc.line(15, yOffset, 195, yOffset);
  yOffset += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL AMOUNT: Rs. ${Number(transaction.amount).toFixed(2)}`, 130, yOffset);

  yOffset += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Voucher Ref: ${transaction.id || 'N/A'}`, 15, yOffset);

  drawFooter(doc, shop, yOffset + 20);

  return doc;
};

export const generateCreditNotePDF = async (order, returnItems, shop, refundAmount, opts = {}) => {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF();
  const themeColor = '#7c3aed';

  let yOffset = drawHeader(doc, shop, 'CREDIT NOTE', themeColor, { showLogo: shop.printShowLogo });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.isFullReturn === false ? 'CREDIT NOTE (PARTIAL RETURN)' : 'CREDIT NOTE (SALES RETURN)', 15, yOffset);
  yOffset += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('REFERENCE:', 15, yOffset);
  yOffset += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Original Invoice Ref: #${(order.id || '').substring(0, 8).toUpperCase()}`, 15, yOffset);
  yOffset += 5;
  if (order.customerGstin) { doc.text(`Customer GSTIN: ${order.customerGstin}`, 15, yOffset); yOffset += 5; }
  const returnDate = opts.returnedAt ? new Date(opts.returnedAt) : new Date();
  doc.text(`Return Date: ${returnDate.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 15, yOffset);
  yOffset += 9;

  doc.setFillColor(248, 250, 252);
  doc.rect(15, yOffset, 180, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Returned Item', 18, yOffset + 6);
  doc.text('Qty', 125, yOffset + 6);
  doc.text('Refund Amount', 165, yOffset + 6);
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 210, 220);
  doc.line(15, yOffset + 9, 195, yOffset + 9);

  yOffset += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  returnItems.forEach(item => {
    doc.text(item.name, 18, yOffset, { maxWidth: 100 });
    doc.text(`${item.returnQty}`, 125, yOffset);
    doc.text(`Rs. ${(item.price * item.returnQty).toFixed(2)}`, 165, yOffset);
    yOffset += 7;
  });

  yOffset += 1;
  doc.setLineWidth(0.3);
  doc.line(15, yOffset, 195, yOffset);
  yOffset += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL CREDIT ISSUED: Rs. ${Number(refundAmount).toFixed(2)}`, 110, yOffset);
  yOffset += 8;

  if (opts.refundMode) {
    const modeLabels = { cash: 'Cash', upi: 'UPI', card: 'Card', store_credit: 'Store Credit' };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(124, 58, 237);
    doc.text(`Refund Mode: ${modeLabels[opts.refundMode] || opts.refundMode}`, 110, yOffset);
    yOffset += 8;
  }

  if (opts.isFullReturn === false) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Note: This is a partial return. The remaining items on the original invoice are still valid.', 15, yOffset, { maxWidth: 180 });
    yOffset += 8;
  }

  drawFooter(doc, shop, yOffset + 15);

  return doc;
};
