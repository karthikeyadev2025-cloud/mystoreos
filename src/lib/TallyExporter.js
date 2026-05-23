// Tally Prime / ERP 9 compatible XML exporter.
// Supports: Sales, Purchase, Payment, Receipt vouchers + Stock items (opening stock).
// Import into Tally: Gateway → Import Data → Masters/Transactions → select file.

function tallyDate(dateStr) {
  // Returns YYYYMMDD as required by Tally
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function ledgerMasters() {
  // Pre-create standard ledgers so they exist before voucher import.
  // Tally silently skips creation if the ledger already exists.
  const defs = [
    { name: 'Sales Account',    parent: 'Sales Accounts' },
    { name: 'Purchase Account', parent: 'Purchase Accounts' },
    { name: 'Cash',             parent: 'Cash-in-Hand' },
    { name: 'Sundry Debtors',   parent: 'Sundry Debtors' },
    { name: 'Sundry Creditors', parent: 'Sundry Creditors' },
  ];
  return defs.map(l => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${l.name}" ACTION="Create">
            <NAME>${l.name}</NAME>
            <PARENT>${l.parent}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>`).join('');
}

function partyInfo(order) {
  if (!order.userId) return { ledger: 'Cash', isB2B: false };
  const parts = order.userId.split(':');
  const name = parts[1]?.trim();
  if (!name || name === 'Guest' || name === 'Walk-in Customer') return { ledger: 'Cash', isB2B: false };
  return { ledger: name, isB2B: true };
}

function salesVouchers(orders) {
  return orders.map(order => {
    const { ledger } = partyInfo(order);
    const amount = Number(order.total || order.totalAmount || 0);
    if (!amount) return '';
    const date = tallyDate(order.date || order.createdAt);
    const vno = (order.id || '').slice(0, 8);
    return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${date}</DATE>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vno}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${ledger}</PARTYLEDGERNAME>
            <NARRATION>${(order.items || []).map(i => i.name).join(', ').slice(0, 100)}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
  }).join('');
}

function purchaseVouchers(stockOrders = []) {
  return stockOrders
    .filter(so => ['accepted', 'Accepted'].includes(so.status))
    .map(so => {
      const amount = Number(so.total || 0);
      if (!amount) return '';
      const date = tallyDate(so.date || so.createdAt);
      const vno = 'PUR-' + (so.id || '').slice(0, 6);
      const supplierLedger = so.supplierName || so.distName || 'Sundry Creditors';
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${date}</DATE>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vno}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${supplierLedger}</PARTYLEDGERNAME>
            <NARRATION>Wholesale restock: ${(so.items || []).map(i => i.name).join(', ').slice(0, 80)}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Purchase Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${supplierLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('');
}

function paymentVouchers(supplierCredits = []) {
  // Payment vouchers: when supplier credit is marked settled (cash goes out)
  return supplierCredits
    .filter(c => c.paid)
    .map(c => {
      const amount = Number(c.amount || 0);
      if (!amount) return '';
      const date = tallyDate(c.date || c.settledAt);
      const vno = 'PAY-' + (c.id || '').slice(0, 6);
      const supplierLedger = c.distName || c.supplierName || 'Sundry Creditors';
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${date}</DATE>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vno}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${supplierLedger}</PARTYLEDGERNAME>
            <NARRATION>Payment to ${supplierLedger}: ${c.desc || ''}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${supplierLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('');
}

function receiptVouchers(customerCredits = []) {
  // Receipt vouchers: when customer credit is marked settled (cash comes in)
  return customerCredits
    .filter(c => c.paid)
    .map(c => {
      const amount = Number(c.amount || 0);
      if (!amount) return '';
      const date = tallyDate(c.date || c.settledAt);
      const vno = 'RCP-' + (c.id || '').slice(0, 6);
      const parts = (c.desc || '').split(':');
      const customerLedger = parts[1]?.trim() || 'Sundry Debtors';
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${date}</DATE>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vno}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${customerLedger}</PARTYLEDGERNAME>
            <NARRATION>Received from ${customerLedger}: ${parts[3] || c.desc || ''}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${customerLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('');
}

function stockItemMasters(products = []) {
  // Opening stock entries as StockItem masters in Tally
  return products
    .filter(p => (p.stock || 0) > 0)
    .map(p => {
      const rate = Number(p.costPrice || p.price || 0).toFixed(2);
      const qty = Number(p.stock || 0);
      const value = (rate * qty).toFixed(2);
      const safeName = (p.name || 'Product').replace(/[<>&"']/g, ' ');
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${safeName}" ACTION="Create">
            <NAME>${safeName}</NAME>
            <BASEUNITS>Nos</BASEUNITS>
            <OPENINGBALANCE>${qty} Nos</OPENINGBALANCE>
            <OPENINGRATE>${rate}/Nos</OPENINGRATE>
            <OPENINGVALUE>${value}</OPENINGVALUE>
          </STOCKITEM>
        </TALLYMESSAGE>`;
    }).join('');
}

export const generateTallyXML = (orders, shopName, {
  stockOrders = [], supplierCredits = [], customerCredits = [], products = [],
} = {}) => {
  const company = (shopName || 'MyStore Company').replace(/[<>&"']/g, ' ');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${ledgerMasters()}
        ${stockItemMasters(products)}
        ${salesVouchers(orders)}
        ${purchaseVouchers(stockOrders)}
        ${paymentVouchers(supplierCredits)}
        ${receiptVouchers(customerCredits)}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
};

export const downloadTallyXML = (orders, shopName, options = {}) => {
  const xml = generateTallyXML(orders, shopName, options);
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Tally_Export_${new Date().toISOString().slice(0, 10)}.xml`;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateGSTR1CSV = (orders = [], _shopGST = '') => {
  const rows = [
    ['GSTIN/UIN', 'Invoice Number', 'Invoice Date', 'Invoice Type', 'Place of Supply', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Invoice Value'],
  ];
  orders.forEach(order => {
    const { isB2B } = partyInfo(order);
    const amount = Number(order.total || order.totalAmount || 0);
    if (!amount) return;
    const d = order.date || order.createdAt ? new Date(order.date || order.createdAt) : new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const taxable = (amount / 1.18).toFixed(2);
    const gst = (amount - Number(taxable)).toFixed(2);
    const half = (Number(gst) / 2).toFixed(2);
    rows.push([
      isB2B ? (order.partyGST || 'URP') : '',
      order.id?.slice(0, 8) || '',
      dateStr,
      isB2B ? 'B2B' : 'B2CS',
      '36-Telangana',
      taxable,
      '0.00',
      half,
      half,
      amount.toFixed(2),
    ]);
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
};

export const generateMonthlySummaryCSV = (orders = []) => {
  const months = {};
  orders.forEach(order => {
    const amount = Number(order.total || order.totalAmount || 0);
    if (!amount) return;
    const d = order.date || order.createdAt ? new Date(order.date || order.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { sales: 0, orders: 0, cash: 0, credit: 0 };
    months[key].sales += amount;
    months[key].orders += 1;
    const { ledger } = partyInfo(order);
    if (ledger === 'Cash') months[key].cash += amount; else months[key].credit += amount;
  });
  const rows = [['Month', 'Total Sales', 'Total Orders', 'Avg Order Value', 'Cash Sales', 'Credit Sales']];
  Object.entries(months).sort().forEach(([month, m]) => {
    rows.push([month, m.sales.toFixed(2), m.orders, (m.sales / m.orders).toFixed(2), m.cash.toFixed(2), m.credit.toFixed(2)]);
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
};

export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
