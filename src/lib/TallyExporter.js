export const generateTallyXML = (orders, shopName) => {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${shopName || 'MyStore Company'}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  orders.forEach((order, _index) => {
    // Generate a voucher for each order
    // In Tally, B2C is often booked under a 'Cash' ledger, B2B under the Customer's ledger.
    // For simplicity, we'll use "Cash" for walk-ins and the customer name if available.
    
    // Attempt to extract name from userId format: `walk-in:Name:Phone` or `estimate:...`
    let customerName = 'Cash';
    let isB2B = false;
    
    if (order.userId) {
      const parts = order.userId.split(':');
      if (parts.length >= 3 && parts[1]) {
        customerName = parts[1];
        if (customerName !== 'Guest') {
          isB2B = true;
        }
      }
    }

    if (order.customerGstin) {
      isB2B = true;
    }

    const partyLedger = isB2B ? customerName : 'Cash';
    const dateStr = new Date(order.createdAt || Date.now())
      .toISOString()
      .split('T')[0]
      .replace(/-/g, ''); // Format: YYYYMMDD for Tally

    const voucherNumber = order.id.substring(0, 8); // Short ID for voucher

    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
            <PARTYNAME>${partyLedger}</PARTYNAME>
            <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
            
            <!-- Dr Party/Cash -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${order.totalAmount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            
            <!-- Cr Sales -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${order.totalAmount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    // Note: To fully support GST in Tally XML, we would need to split the amount 
    // into Taxable, CGST, SGST ledgers. For MVP, we pass the gross amount to Sales.
    // In a complete implementation, we would loop through items and calculate GST per rate.

    xml += `
          </VOUCHER>
        </TALLYMESSAGE>
`;
  });

  xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
};

export const downloadTallyXML = (orders, shopName) => {
  const xmlContent = generateTallyXML(orders, shopName);
  const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `Tally_Sales_Export_${new Date().toISOString().split('T')[0]}.xml`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
