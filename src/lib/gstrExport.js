const STATE_NAMES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

function getStateName(code) {
  return STATE_NAMES[String(code).padStart(2, '0')] || 'Unknown';
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

// Generates a GSTR-1 compatible CSV for the given orders and shop profile.
// Orders should include: id, date, userId, total, gstRate (optional), customerGstin (optional).
export function generateGSTR1CSV(orders, shopProfile) {
  const headers = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Invoice Number',
    'Invoice Date (DD-MON-YYYY)',
    'Invoice Value',
    'Place Of Supply',
    'Reverse Charge',
    'Invoice Type',
    'Rate (%)',
    'Taxable Value',
    'CGST Amount',
    'SGST/UTGST Amount',
    'IGST Amount',
    'Cess Amount',
  ];

  const shopStateCode = String(shopProfile?.stateCode || '37').padStart(2, '0');
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const completed = orders.filter(o =>
    o.status === 'completed' || o.status === 'Accepted' || o.status === 'accepted',
  );

  const rows = completed.map(order => {
    const d = new Date(order.date || order.createdAt || Date.now());
    const dateStr = `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;

    let customerName = 'Consumer';
    let customerGstin = order.customerGstin || '';

    if (order.userId) {
      const parts = order.userId.split(':');
      if (parts.length >= 2 && parts[1] && parts[1] !== 'Guest') customerName = parts[1];
    }

    const buyerStateCode = customerGstin
      ? String(customerGstin).slice(0, 2).padStart(2, '0')
      : shopStateCode;

    const total = Number(order.total || order.totalAmount || 0);
    const gstRate = Number(order.gstRate ?? 5);
    const taxableValue = gstRate > 0 ? total / (1 + gstRate / 100) : total;
    const gstAmount = total - taxableValue;
    const isInterState = buyerStateCode !== shopStateCode;

    return [
      customerGstin,
      customerName,
      order.id.slice(0, 12).toUpperCase(),
      dateStr,
      total.toFixed(2),
      `${buyerStateCode}-${getStateName(buyerStateCode)}`,
      'N',
      customerGstin ? 'Regular' : 'B2C Others',
      `${gstRate}`,
      taxableValue.toFixed(2),
      isInterState ? '0.00' : (gstAmount / 2).toFixed(2),
      isInterState ? '0.00' : (gstAmount / 2).toFixed(2),
      isInterState ? gstAmount.toFixed(2) : '0.00',
      '0.00',
    ].map(csvCell).join(',');
  });

  return [headers.map(csvCell).join(','), ...rows].join('\r\n');
}

export function downloadGSTR1CSV(orders, shopProfile, period) {
  const csv = generateGSTR1CSV(orders, shopProfile);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `GSTR1_${period || new Date().toISOString().slice(0, 7)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Summarizes GST by rate slab — useful for the CA portal overview.
export function summarizeGST(orders, shopProfile) {
  const shopStateCode = String(shopProfile?.stateCode || '37').padStart(2, '0');
  let totalRevenue = 0, totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

  const completed = orders.filter(o =>
    o.status === 'completed' || o.status === 'Accepted' || o.status === 'accepted',
  );

  completed.forEach(order => {
    const total = Number(order.total || order.totalAmount || 0);
    const gstRate = Number(order.gstRate ?? 5);
    const taxable = gstRate > 0 ? total / (1 + gstRate / 100) : total;
    const gst = total - taxable;
    const buyerState = order.customerGstin
      ? String(order.customerGstin).slice(0, 2).padStart(2, '0')
      : shopStateCode;
    const isInterState = buyerState !== shopStateCode;

    totalRevenue += total;
    totalTaxable += taxable;
    if (isInterState) {
      totalIGST += gst;
    } else {
      totalCGST += gst / 2;
      totalSGST += gst / 2;
    }
  });

  return {
    invoiceCount: completed.length,
    totalRevenue,
    totalTaxable,
    totalCGST,
    totalSGST,
    totalIGST,
    totalGST: totalCGST + totalSGST + totalIGST,
  };
}
