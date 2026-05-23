// Zoho CRM CSV exporters.
// Zoho expects a UTF-8 BOM for ₹ + Indic characters; otherwise it mojibakes on import.

const BOM = '﻿';

const escapeCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

export const generateZohoContactsCSV = (customers) => {
  const headers = 'First Name,Last Name,Phone,Email,Account Name,Description';
  const rows = (customers || []).map(c => {
    const nameParts = (c.name || 'Customer').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    return [
      escapeCell(firstName),
      escapeCell(lastName),
      escapeCell(c.phone || ''),
      escapeCell(c.email || ''),
      escapeCell(c.shopName || ''),
      escapeCell(`MyStore OS Customer — Orders: ${c.orderCount || 0}, Total: ₹${c.totalSpent || 0}`),
    ].join(',');
  });
  return BOM + [headers, ...rows].join('\n');
};

export const generateZohoLeadsCSV = (shops) => {
  const headers = 'First Name,Last Name,Company,Phone,Email,Lead Source,Description';
  const rows = (shops || []).map(s => {
    const nameParts = (s.name || 'Shop Owner').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    return [
      escapeCell(firstName),
      escapeCell(lastName),
      escapeCell(s.name || ''),
      escapeCell(s.phone || ''),
      escapeCell(s.email || ''),
      escapeCell('MyStore OS'),
      escapeCell(`Tier: ${s.subscriptionTier || 'starter'}, Status: ${s.status || 'unknown'}`),
    ].join(',');
  });
  return BOM + [headers, ...rows].join('\n');
};

export const downloadZohoCSV = (csv, filename) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
