// jsPDF is dynamically imported so the ~151 KB chunk loads only on first PDF generation
async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

const drawHeader = (doc, shop, title, themeColor) => {
  doc.setFillColor(
    parseInt(themeColor.substring(1, 3), 16),
    parseInt(themeColor.substring(3, 5), 16),
    parseInt(themeColor.substring(5, 7), 16),
  );
  doc.rect(0, 0, 210, 8, 'F');

  if (shop.logo && shop.logo.startsWith('data:image')) {
    try { doc.addImage(shop.logo, 'JPEG', 15, 12, 25, 25); } catch (_logoErr) { /* unsupported format */ }
  }

  const textX = (shop.logo && shop.logo.startsWith('data:image')) ? 45 : 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(shop.name || 'Shop', textX, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Phone: ${shop.phone || ''}`, textX, 28);
  if (shop.upiId) doc.text(`UPI: ${shop.upiId}`, textX, 33);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 42, 195, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(
    parseInt(themeColor.substring(1, 3), 16),
    parseInt(themeColor.substring(3, 5), 16),
    parseInt(themeColor.substring(5, 7), 16),
  );
  doc.text(title, 15, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${new Date().toLocaleString()}`, 135, 50);

  if (shop.gstin) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`GSTIN: ${shop.gstin} | State Code: ${shop.stateCode || ''}`, 15, 41);
    if (shop.businessAddress) doc.text(shop.businessAddress, 15, 45);
  }
};

export const generateVoucherPDF = async (transaction, shop, isReceipt = true) => {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF();
  const themeColor = isReceipt ? '#10b981' : '#ef4444';
  const title = isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';

  drawHeader(doc, shop, title, themeColor);

  let yOffset = 58;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PARTY DETAILS:', 15, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${transaction.partyName || 'Customer/Supplier'}`, 15, yOffset + 6);
  if (transaction.partyPhone) doc.text(`Phone: ${transaction.partyPhone}`, 15, yOffset + 12);
  if (transaction.partyDesc) doc.text(`Reference: ${transaction.partyDesc}`, 15, yOffset + 18);

  yOffset += 28;

  doc.setFillColor(248, 250, 252);
  doc.rect(15, yOffset, 180, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Description', 18, yOffset + 6.5);
  doc.text('Amount (Rs)', 165, yOffset + 6.5);
  doc.line(15, yOffset + 10, 195, yOffset + 10);

  yOffset += 16;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    isReceipt
      ? 'Received Cash / UPI payment against outstanding balance'
      : 'Paid Cash / UPI payment against outstanding balance',
    18, yOffset,
  );
  doc.text(Number(transaction.amount).toFixed(2), 165, yOffset);

  yOffset += 12;
  doc.line(15, yOffset, 195, yOffset);
  yOffset += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL AMOUNT: Rs. ${Number(transaction.amount).toFixed(2)}`, 130, yOffset);

  yOffset += 15;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Voucher Ref: ${transaction.id || 'N/A'}`, 15, yOffset);

  return doc;
};

export const generateCreditNotePDF = async (order, returnItems, shop, refundAmount) => {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF();
  const themeColor = '#8b5cf6';

  drawHeader(doc, shop, 'CREDIT NOTE (SALES RETURN)', themeColor);

  let yOffset = 58;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REFERENCE:', 15, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(`Original Invoice Ref: #${order.id.substring(0, 8)}`, 15, yOffset + 6);
  if (order.customerGstin) doc.text(`Customer GSTIN: ${order.customerGstin}`, 15, yOffset + 12);

  yOffset += 20;

  doc.setFillColor(248, 250, 252);
  doc.rect(15, yOffset, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Returned Item', 18, yOffset + 5.5);
  doc.text('Qty', 120, yOffset + 5.5);
  doc.text('Refund Amount', 160, yOffset + 5.5);
  doc.line(15, yOffset + 8, 195, yOffset + 8);

  yOffset += 13;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  returnItems.forEach(item => {
    doc.text(item.name, 18, yOffset);
    doc.text(`${item.returnQty}`, 120, yOffset);
    doc.text(`${(item.price * item.returnQty).toFixed(2)}`, 160, yOffset);
    yOffset += 8;
  });

  doc.line(15, yOffset - 2, 195, yOffset - 2);
  yOffset += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL CREDIT ISSUED: Rs. ${refundAmount.toFixed(2)}`, 115, yOffset);

  return doc;
};
