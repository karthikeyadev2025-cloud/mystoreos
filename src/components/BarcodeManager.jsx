import { useState, useEffect, useRef, useCallback } from 'react';
import Barcode from 'react-barcode';
import { X, ScanLine, Printer, Check, Search, Layers, Tag, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';

// Supported symbologies the shopkeeper can pick per product.
const FORMATS = [
  { value: 'CODE128', label: 'CODE128 (default · alphanumeric)' },
  { value: 'EAN13', label: 'EAN-13 (13-digit retail)' },
  { value: 'UPC', label: 'UPC-A (12-digit)' },
  { value: 'CODE39', label: 'CODE39 (legacy)' },
];

// Generate a unique, valid barcode value. For EAN13 we need 12 digits (+ checksum
// auto-added by the renderer); for others a timestamp-based numeric string is fine.
function genBarcodeValue(format) {
  const base = (Date.now().toString().slice(-9) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'));
  if (format === 'EAN13') return ('200' + base).slice(0, 12); // 12 digits, checksum auto
  if (format === 'UPC') return ('0' + base).slice(0, 11);     // 11 digits, checksum auto
  return 'MS' + base; // CODE128/CODE39 alphanumeric
}

// Validate a value for a given format so the renderer doesn't crash.
function isValidFor(format, value) {
  if (!value) return false;
  if (format === 'EAN13') return /^\d{12,13}$/.test(value);
  if (format === 'UPC') return /^\d{11,12}$/.test(value);
  if (format === 'CODE39') return /^[0-9A-Z\-. $+%]+$/.test(value);
  return true; // CODE128 accepts most ASCII
}

export default function BarcodeManager({ products, shopName, onClose, onAssignBarcode, onScanToAdd }) {
  const [tab, setTab] = useState('manage'); // manage | scan | print
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // productId -> true
  const [labelFormat, setLabelFormat] = useState('a4'); // a4 | thermal
  const [perProductFormat, setPerProductFormat] = useState({}); // productId -> symbology
  const [scanResult, setScanResult] = useState(null);
  const printRef = useRef(null);

  const fmtFor = useCallback((p) => perProductFormat[p.id] || p.barcodeFormat || 'CODE128', [perProductFormat]);

  const filtered = (products || []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)
  );

  const selectedProducts = (products || []).filter(p => selected[p.id]);

  // ─── Camera scanner (reuses html5-qrcode, loaded on demand) ───
  useEffect(() => {
    if (tab !== 'scan') return;
    let scanner = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (cancelled) return;
        scanner = new Html5QrcodeScanner('bc-mgr-reader', { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true }, false);
        scanner.render(
          (decodedText) => {
            const found = (products || []).find(p => p.barcode === decodedText);
            setScanResult({ code: decodedText, product: found || null });
            scanner.clear().catch(() => {});
            if (found) toast.success(`Found: ${found.name}`);
            else toast.info('➕ New barcode — add as product');
          },
          () => {}
        );
      } catch (_e) {
        toast.error('Could not start camera scanner');
      }
    })();
    return () => { cancelled = true; scanner?.clear().catch(() => {}); };
  }, [tab, products]);

  const toggleAll = () => {
    if (selectedProducts.length === filtered.length) setSelected({});
    else { const next = {}; filtered.forEach(p => { next[p.id] = true; }); setSelected(next); }
  };

  // Assign a freshly generated barcode to a product that has none.
  const handleGenerate = async (p) => {
    const fmt = fmtFor(p);
    const value = genBarcodeValue(fmt);
    try {
      await onAssignBarcode(p.id, value, fmt);
      toast.success(`Barcode generated for ${p.name}`);
    } catch (_e) {
      toast.error('Could not save barcode');
    }
  };

  // Print the selected products' labels by opening a print window with only the labels.
  const handlePrint = () => {
    const items = selectedProducts.filter(p => p.barcode);
    if (!items.length) { toast.error('Select products that have a barcode (generate one first)'); return; }
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Allow pop-ups to print'); return; }

    // Build label HTML. We render the SVG markup from the on-page barcodes by id.
    const labelHtml = items.map(p => {
      const svg = printRef.current?.querySelector(`#bc-svg-${p.id}`)?.outerHTML || '';
      return `
        <div class="label">
          <div class="shop">${shopName || ''}</div>
          <div class="pname">${(p.name || '').replace(/</g, '&lt;')}</div>
          <div class="bc">${svg}</div>
          <div class="price">₹${p.price}</div>
        </div>`;
    }).join('');

    const a4Css = `
      @page { size: A4; margin: 8mm; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .label { border: 1px dashed #bbb; padding: 6px; text-align: center; break-inside: avoid; }
      .shop { font-size: 9px; color: #444; font-weight: 700; }
      .pname { font-size: 11px; font-weight: 700; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bc svg { max-width: 100%; height: auto; }
      .price { font-size: 13px; font-weight: 800; margin-top: 2px; }`;
    const thermalCss = `
      @page { size: 50mm 30mm; margin: 1mm; }
      .sheet { display: block; }
      .label { width: 48mm; padding: 1mm 0; text-align: center; page-break-after: always; }
      .shop { font-size: 8px; color: #000; font-weight: 700; }
      .pname { font-size: 10px; font-weight: 700; margin: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bc svg { max-width: 100%; height: auto; }
      .price { font-size: 12px; font-weight: 800; }`;

    win.document.write(`<!doctype html><html><head><title>Barcode Labels</title>
      <style>body{font-family:Arial,sans-serif;margin:0;}${labelFormat === 'a4' ? a4Css : thermalCss}</style>
      </head><body><div class="sheet">${labelHtml}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</` + `script>
      </body></html>`);
    win.document.close();
  };

  const noBarcodeCount = (products || []).filter(p => !p.barcode).length;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: '860px', maxHeight: '92vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
            <Layers size={22} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Barcode Manager</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>Scan · Generate · Print labels in batches</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 22px 0', borderBottom: '1px solid #E2E8F0' }}>
          {[{ k: 'manage', label: 'Manage & Generate', icon: Tag }, { k: 'scan', label: 'Scan', icon: ScanLine }, { k: 'print', label: `Batch Print${selectedProducts.length ? ` (${selectedProducts.length})` : ''}`, icon: Printer }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', border: 'none', background: 'none', borderBottom: tab === t.k ? '2px solid #4F46E5' : '2px solid transparent', color: tab === t.k ? '#4F46E5' : '#64748B', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div ref={printRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* ─── MANAGE & GENERATE ─── */}
          {tab === 'manage' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <button onClick={toggleAll} style={{ padding: '9px 14px', border: '1px solid #CBD5E1', background: '#F8FAFC', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
                  {selectedProducts.length === filtered.length && filtered.length ? 'Unselect all' : 'Select all'}
                </button>
              </div>
              {noBarcodeCount > 0 && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#92400E', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> {noBarcodeCount} product{noBarcodeCount !== 1 ? 's' : ''} have no barcode — click "Generate" to create one.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.map(p => {
                  const fmt = fmtFor(p);
                  const valid = isValidFor(fmt, p.barcode);
                  return (
                    <div key={p.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', background: selected[p.id] ? '#EEF2FF' : '#fff' }}>
                      <input type="checkbox" checked={!!selected[p.id]} onChange={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>₹{p.price} · {p.barcode ? <span style={{ fontFamily: 'monospace' }}>{p.barcode}</span> : <span style={{ color: '#DC2626' }}>no barcode</span>}</div>
                      </div>
                      {/* per-product format */}
                      <select value={fmt} onChange={e => setPerProductFormat(m => ({ ...m, [p.id]: e.target.value }))} style={{ padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '11px', maxWidth: '130px' }}>
                        {FORMATS.map(f => <option key={f.value} value={f.value}>{f.value}</option>)}
                      </select>
                      {p.barcode && valid ? (
                        <div id={`bc-svg-wrap-${p.id}`} style={{ background: '#fff', padding: '2px' }}>
                          <Barcode id={`bc-svg-${p.id}`} value={p.barcode} format={fmt} height={34} width={1.3} fontSize={11} margin={2} renderer="svg" />
                        </div>
                      ) : (
                        <button onClick={() => handleGenerate(p)} style={{ padding: '8px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Generate
                        </button>
                      )}
                    </div>
                  );
                })}
                {!filtered.length && <div style={{ textAlign: 'center', color: '#94A3B8', padding: '24px', fontSize: '13px' }}>No products match.</div>}
              </div>
            </div>
          )}

          {/* ─── SCAN ─── */}
          {tab === 'scan' && (
            <div style={{ textAlign: 'center' }}>
              {!scanResult && <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>Point your camera at a product barcode.</p>}
              {!scanResult && <div id="bc-mgr-reader" style={{ maxWidth: '420px', margin: '0 auto' }} />}
              {scanResult && (
                <div style={{ maxWidth: '420px', margin: '0 auto', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Scanned code</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 800, margin: '4px 0 14px' }}>{scanResult.code}</div>
                  {scanResult.product ? (
                    <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Check size={16} /> Product found</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '6px' }}>{scanResult.product.name}</div>
                      <div style={{ fontSize: '13px', color: '#475569' }}>₹{scanResult.product.price} · Stock: {scanResult.product.stock}</div>
                    </div>
                  ) : (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ color: '#92400E', fontWeight: 800 }}>New barcode — not in inventory</div>
                      <button onClick={() => { onScanToAdd?.(scanResult.code); onClose(); }} style={{ marginTop: '10px', padding: '10px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                        ➕ Add as new product
                      </button>
                    </div>
                  )}
                  <button onClick={() => setScanResult(null)} style={{ marginTop: '14px', padding: '8px 16px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Scan another</button>
                </div>
              )}
            </div>
          )}

          {/* ─── BATCH PRINT ─── */}
          {tab === 'print' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Label format</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[{ k: 'a4', label: 'A4 Sheet (3-up grid)' }, { k: 'thermal', label: 'Thermal (50×30mm)' }].map(o => (
                      <button key={o.k} onClick={() => setLabelFormat(o.k)} style={{ flex: 1, padding: '10px', border: labelFormat === o.k ? '2px solid #4F46E5' : '1px solid #CBD5E1', background: labelFormat === o.k ? '#EEF2FF' : '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: labelFormat === o.k ? '#4F46E5' : '#475569' }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                {selectedProducts.length ? `${selectedProducts.filter(p => p.barcode).length} label(s) ready to print` : 'Select products in the "Manage & Generate" tab first.'}
              </div>
              {/* Hidden barcodes for selected products so print window can pull their SVG */}
              <div style={{ display: 'grid', gridTemplateColumns: labelFormat === 'a4' ? 'repeat(auto-fill,minmax(150px,1fr))' : '1fr', gap: '10px' }}>
                {selectedProducts.filter(p => p.barcode).map(p => (
                  <div key={p.id} style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569' }}>{shopName}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <Barcode id={`bc-svg-${p.id}`} value={p.barcode} format={fmtFor(p)} height={34} width={1.2} fontSize={10} margin={2} renderer="svg" />
                    <div style={{ fontSize: '13px', fontWeight: 800 }}>₹{p.price}</div>
                  </div>
                ))}
              </div>
              <button onClick={handlePrint} disabled={!selectedProducts.filter(p => p.barcode).length} style={{ marginTop: '18px', width: '100%', padding: '14px', background: selectedProducts.filter(p => p.barcode).length ? 'linear-gradient(135deg,#4F46E5,#7C3AED)' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Printer size={18} /> Print {selectedProducts.filter(p => p.barcode).length} Label{selectedProducts.filter(p => p.barcode).length !== 1 ? 's' : ''} ({labelFormat === 'a4' ? 'A4' : 'Thermal'})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
