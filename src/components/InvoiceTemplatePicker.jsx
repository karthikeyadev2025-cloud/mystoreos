import { INVOICE_TEMPLATES, renderInvoiceHtml } from '../lib/invoiceTemplates';
import { FileText } from 'lucide-react';

// Sample data used purely to render the little preview thumbnails —
// never sent anywhere, never saved. Picked to look reasonably full
// (multiple items, a customer name) so each template's real character
// shows through in the tiny preview.
const SAMPLE_DATA = {
  shopName: 'Your Shop Name',
  shopPhone: '98765 43210',
  shopAddress: 'Main Road, Your City',
  shopGSTIN: '36AAAAA0000A1Z5',
  billNo: 'INV-0001',
  dateStr: '12 Jul 2026',
  customerName: 'Sample Customer',
  customerPhone: '90000 00000',
  items: [
    { code: '101', name: 'Item One', hsn: '1905', qty: 5, rate: 100, gstPct: 5 },
    { code: '102', name: 'Item Two', qty: 2, rate: 250, gstPct: 5 },
    { code: '103', name: 'Item Three', qty: 10, rate: 40, gstPct: 5 },
  ],
  subtotal: 1400,
  total: 1400,
};

// Renders each template's real HTML inside a tiny scaled-down iframe so
// the shop owner sees the ACTUAL layout, not a description of it —
// much more useful for deciding than reading a one-line blurb.
function TemplateThumb({ templateId }) {
  const html = renderInvoiceHtml(templateId, SAMPLE_DATA, 210);
  // Strip the whole <script>…</script> block rather than patching
  // individual window.print() calls — the print shell fires TWO
  // separate triggers (onload + a timeout fallback) so a partial
  // string replace would still let one slip through and pop a real
  // print dialog every time this settings page renders.
  const previewHtml = html.replace(/<script>[\s\S]*?<\/script>/, '');
  return (
    <div style={{
      width: '100%', height: 150, borderRadius: 8, overflow: 'hidden',
      border: '1px solid var(--c-line)', background: 'var(--c-surface)', position: 'relative',
      pointerEvents: 'none',
    }}>
      <iframe
        title={`${templateId}-preview`}
        srcDoc={previewHtml}
        style={{
          width: 700, height: 900, border: 'none',
          transform: 'scale(0.21)', transformOrigin: 'top left',
        }}
        tabIndex={-1}
        sandbox=""
      />
    </div>
  );
}

// Props:
//   value    — currently selected template id
//   onChange — (id) => void
export default function InvoiceTemplatePicker({ value, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FileText size={16} color="var(--c-primary)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-ink)' }}>Invoice Template</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
      }}>
        {INVOICE_TEMPLATES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                textAlign: 'left', cursor: 'pointer', width: '100%',
                background: active ? 'var(--c-primary-soft)' : 'var(--c-surface)',
                border: `2px solid ${active ? 'var(--c-primary)' : 'var(--c-line)'}`,
                borderRadius: 12, padding: 10,
                transition: 'border-color .15s, background .15s',
              }}
            >
              <TemplateThumb templateId={t.id} />
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: active ? 'var(--c-primary)' : 'var(--c-ink)' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {t.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
