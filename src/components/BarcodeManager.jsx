import { useState, useEffect, useRef, useCallback } from 'react';
import Barcode from 'react-barcode';
import { X, ScanLine, Printer, Check, Search, Layers, Tag, Sparkles, Percent } from 'lucide-react';
import { toast } from 'react-toastify';

const FORMATS = [
  { value: 'CODE128', label: 'CODE128 (default · alphanumeric)' },
  { value: 'EAN13',   label: 'EAN-13 (13-digit retail)' },
  { value: 'UPC',     label: 'UPC-A (12-digit)' },
  { value: 'CODE39',  label: 'CODE39 (legacy)' },
];

function genBarcodeValue(format) {
  const base = (Date.now().toString().slice(-9) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'));
  if (format === 'EAN13') return ('200' + base).slice(0, 12);
  if (format === 'UPC')   return ('0'   + base).slice(0, 11);
  return 'MS' + base;
}

function isValidFor(format, value) {
  if (!value) return false;
  if (format === 'EAN13') return /^\d{12,13}$/.test(value);
  if (format === 'UPC')   return /^\d{11,12}$/.test(value);
  if (format === 'CODE39') return /^[0-9A-Z\-. $+%]+$/.test(value);
  return true;
}

export default function BarcodeManager({ products, shopName, shopId, onClose, onAssignBarcode, onScanToAdd, getSiteConfig, saveSiteConfig }) {
  const [tab,              setTab]              = useState('manage');
  const [search,           setSearch]           = useState('');
  const [selected,         setSelected]         = useState({});
  const [labelFormat,      setLabelFormat]      = useState('a4');
  const [perProductFormat, setPerProductFormat] = useState({});
  const [discounts,        setDiscounts]        = useState({}); // productId -> % string
  const [scanResult,       setScanResult]       = useState(null);
  const printContainerRef = useRef(null); // hidden barcode DOM for SVG capture

  // Remember which label paper this shop has loaded (A4 sheet vs 58x40mm
  // thermal roll) so it doesn't silently reset to A4 every time the modal
  // is reopened — a shop with a thermal label printer had to re-select it
  // every single time before this, risking an A4 layout being sent to a
  // thermal printer by mistake.
  useEffect(() => {
    if (!getSiteConfig || !shopId) return;
    (async () => {
      const saved = await getSiteConfig(`barcodeLabelFormat_${shopId}`, 'a4');
      if (saved === 'a4' || saved === 'thermal') setLabelFormat(saved);
    })();
  }, [getSiteConfig, shopId]);

  const changeLabelFormat = (fmt) => {
    setLabelFormat(fmt);
    if (saveSiteConfig && shopId) saveSiteConfig(`barcodeLabelFormat_${shopId}`, fmt);
  };

  const fmtFor  = useCallback((p) => perProductFormat[p.id] || p.barcodeFormat || 'CODE128', [perProductFormat]);
  // discFor: prefer local override, fallback to saved product.discountPct
  const discFor = useCallback((p) => {
    const local = discounts[p.id];
    if (local !== undefined && local !== '') return Number(local);
    return Number(p.discountPct) || 0;
  }, [discounts]);

  const filtered         = (products || []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)
  );
  const selectedProducts = (products || []).filter(p => selected[p.id]);
  const noBarcodeCount   = (products || []).filter(p => !p.barcode).length;

  // ─── Camera scanner ───
  useEffect(() => {
    if (tab !== 'scan') return;
    let scanner = null, cancelled = false;
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
            else       toast.info('➕ New barcode — add as product');
          },
          () => {}
        );
      } catch (_e) { toast.error('Could not start camera scanner'); }
    })();
    return () => { cancelled = true; scanner?.clear().catch(() => {}); };
  }, [tab, products]);

  const toggleAll = () => {
    if (selectedProducts.length === filtered.length) setSelected({});
    else { const next = {}; filtered.forEach(p => { next[p.id] = true; }); setSelected(next); }
  };

  const handleGenerate = async (p) => {
    const fmt = fmtFor(p), value = genBarcodeValue(fmt);
    try {
      await onAssignBarcode(p.id, value, fmt);
      toast.success(`Barcode generated for ${p.name}`);
    } catch (_e) { toast.error('Could not save barcode'); }
  };

  // Grab SVG from the hidden print container (always rendered, always in DOM)
  const getSvgForProduct = (p) => {
    if (!printContainerRef.current) return '';
    const el = printContainerRef.current.querySelector(`#pbc-${p.id}`);
    return el?.querySelector('svg')?.outerHTML || '';
  };

  const handlePrint = () => {
    const items = selectedProducts.filter(p => p.barcode);
    if (!items.length) { toast.error('Select products with a barcode first'); return; }
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Allow pop-ups to print'); return; }

    const labelHtml = items.map(p => {
      const svg    = getSvgForProduct(p);
      const mrp    = Number(p.price) || 0;
      const pct    = discFor(p);
      const sale   = pct > 0 ? Math.round(mrp * (1 - pct / 100)) : null;

      const priceBlock = sale != null
        ? `<div class="mrp-row">
             <span class="mrp-label">MRP</span>
             <span class="mrp-strike">&#x20B9;${mrp}</span>
             <span class="disc-badge">${pct}% OFF</span>
           </div>
           <div class="sale-price">&#x20B9;${sale}</div>`
        : `<div class="price">&#x20B9;${mrp}</div>`;

      return `
        <div class="label">
          <div class="shop">${(shopName || '').replace(/</g,'&lt;')}</div>
          <div class="pname">${(p.name || '').replace(/</g,'&lt;')}</div>
          <div class="bc">${svg}</div>
          ${priceBlock}
        </div>`;
    }).join('');

    const a4Css = `
      @page { size: A4; margin: 8mm; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .label { border: 1px dashed #bbb; padding: 6px; text-align: center; break-inside: avoid; }
      .shop  { font-size: 9px; color: #444; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      .pname { font-size: 11px; font-weight: 700; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bc svg { max-width: 100%; height: auto; }
      .price { font-size: 14px; font-weight: 800; margin-top: 2px; }
      .mrp-row { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
      .mrp-label { font-size: 8px; color: #666; font-weight: 700; }
      .mrp-strike { font-size: 10px; text-decoration: line-through; color: #999; }
      .disc-badge { background: var(--c-danger); color: var(--c-surface); font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; }
      .sale-price { font-size: 17px; font-weight: 900; color: var(--c-success-strong); margin-top: 1px; }`;

    const thermalCss = `
      @page { size: 58mm 40mm; margin: 1mm; }
      .sheet { display: block; }
      .label { width: 56mm; height: 38mm; padding: 0.5mm 0; text-align: center; page-break-after: always; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
      .shop  { font-size: 6.5px; color: #000; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
      .pname { font-size: 8.5px; font-weight: 700; margin: 0.5mm 0; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 1mm; }
      .bc svg { max-width: 100%; height: 9mm !important; }
      .price { font-size: 11px; font-weight: 800; line-height: 1.1; }
      .mrp-row { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; margin-top: 0.5mm; line-height: 1; }
      .mrp-label { font-size: 6px; color: #555; font-weight: 700; }
      .mrp-strike { font-size: 7.5px; text-decoration: line-through; color: #888; }
      .disc-badge { background: #000; color: var(--c-surface); font-size: 6px; font-weight: 800; padding: 0.5px 2px; border-radius: 2px; }
      .sale-price { font-size: 12px; font-weight: 900; color: #000; line-height: 1.1; }`;

    win.document.write(`<!doctype html><html><head><title>Price Labels</title>
      <style>body{font-family:Arial,sans-serif;margin:0;}${labelFormat === 'a4' ? a4Css : thermalCss}</style>
      </head><body><div class="sheet">${labelHtml}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</` + `script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-surface)', width: '100%', maxWidth: '900px', maxHeight: '92vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Hidden barcode container — always in DOM so getSvgForProduct() can find SVGs */}
        <div ref={printContainerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
          {(products || []).filter(p => p.barcode).map(p => (
            <div key={p.id} id={`pbc-${p.id}`}>
              <Barcode value={p.barcode} format={fmtFor(p)} height={34} width={1.3} fontSize={11} margin={2} renderer="svg" />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--c-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,var(--c-primary),var(--c-violet))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--c-surface)' }}>
            <Layers size={22} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Barcode & Price Label Manager</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>Scan · Generate · Print labels with discounts</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--c-surface)', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 22px 0', borderBottom: '1px solid var(--c-line)' }}>
          {[
            { k: 'manage', label: 'Manage & Generate', icon: Tag },
            { k: 'scan',   label: 'Scan',               icon: ScanLine },
            { k: 'print',  label: `Print Labels${selectedProducts.length ? ` (${selectedProducts.length})` : ''}`, icon: Printer },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', border: 'none', background: 'none', borderBottom: tab === t.k ? '2px solid var(--c-primary)' : '2px solid transparent', color: tab === t.k ? 'var(--c-primary)' : 'var(--c-muted)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* ─── MANAGE & GENERATE ─── */}
          {tab === 'manage' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-faint)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--c-line-strong)', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <button onClick={toggleAll} style={{ padding: '9px 14px', border: '1px solid var(--c-line-strong)', background: 'var(--c-bg)', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'var(--c-ink-2)' }}>
                  {selectedProducts.length === filtered.length && filtered.length ? 'Unselect all' : 'Select all'}
                </button>
              </div>

              {noBarcodeCount > 0 && (
                <div style={{ background: 'var(--c-warning-soft)', border: '1px solid var(--c-warning)', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: 'var(--c-warning-strong)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> {noBarcodeCount} product{noBarcodeCount !== 1 ? 's' : ''} have no barcode — click "Generate" to create one.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.map(p => {
                  const fmt     = fmtFor(p);
                  const valid   = isValidFor(fmt, p.barcode);
                  const discPct = discFor(p);
                  const mrp     = Number(p.price) || 0;
                  const saleAmt = discPct > 0 ? Math.round(mrp * (1 - discPct / 100)) : null;
                  const localOverride = discounts[p.id] !== undefined ? discounts[p.id] : '';

                  return (
                    <div key={p.id} style={{ border: '1px solid var(--c-line)', borderRadius: '12px', padding: '12px 14px', background: selected[p.id] ? 'var(--c-primary-soft)' : 'var(--c-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <input type="checkbox" checked={!!selected[p.id]} onChange={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))} style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '2px' }}>
                            MRP ₹{mrp}
                            {saleAmt != null && (
                              <> &rarr; <span style={{ color: 'var(--c-success-strong)', fontWeight: 700 }}>₹{saleAmt}</span>{' '}
                                <span style={{ background: 'var(--c-danger)', color: 'var(--c-surface)', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' }}>{discPct}% OFF</span>
                              </>
                            )}
                            {' · '}
                            {p.barcode ? <span style={{ fontFamily: 'monospace' }}>{p.barcode}</span> : <span style={{ color: 'var(--c-danger-strong)' }}>no barcode</span>}
                          </div>
                        </div>

                        {/* Discount % input — shows saved value, allow override */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '8px', padding: '4px 8px', minWidth: '110px' }}>
                          <Percent size={12} color="var(--c-muted)" />
                          <input
                            type="number" min="0" max="99"
                            placeholder={p.discountPct > 0 ? String(p.discountPct) : '0'}
                            value={localOverride}
                            onChange={e => setDiscounts(d => ({ ...d, [p.id]: e.target.value }))}
                            style={{ width: '50px', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 700, color: 'var(--c-ink)', outline: 'none' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--c-muted)' }}>% off</span>
                        </div>

                        {/* Symbology */}
                        <select value={fmt} onChange={e => setPerProductFormat(m => ({ ...m, [p.id]: e.target.value }))} style={{ padding: '6px 8px', border: '1px solid var(--c-line-strong)', borderRadius: '8px', fontSize: '11px', maxWidth: '130px' }}>
                          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.value}</option>)}
                        </select>

                        {/* Barcode preview or generate */}
                        {p.barcode && valid ? (
                          <div style={{ background: 'var(--c-surface)', padding: '2px' }}>
                            <Barcode value={p.barcode} format={fmt} height={34} width={1.3} fontSize={11} margin={2} renderer="svg" />
                          </div>
                        ) : (
                          <button onClick={() => handleGenerate(p)} style={{ padding: '8px 12px', background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Generate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!filtered.length && <div style={{ textAlign: 'center', color: 'var(--c-faint)', padding: '24px', fontSize: '13px' }}>No products match.</div>}
              </div>
            </div>
          )}

          {/* ─── SCAN ─── */}
          {tab === 'scan' && (
            <div style={{ textAlign: 'center' }}>
              {!scanResult && <p style={{ fontSize: '13px', color: 'var(--c-muted)', marginBottom: '12px' }}>Point your camera at a product barcode to instantly identify it.</p>}
              {!scanResult && <div id="bc-mgr-reader" style={{ maxWidth: '420px', margin: '0 auto' }} />}
              {scanResult && (
                <div style={{ maxWidth: '420px', margin: '0 auto', border: '1px solid var(--c-line)', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--c-muted)' }}>Scanned code</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 800, margin: '4px 0 14px' }}>{scanResult.code}</div>
                  {scanResult.product ? (
                    <div style={{ background: 'var(--c-success-soft)', border: '1px solid var(--c-success-soft)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ color: 'var(--c-success-strong)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Check size={16} /> Product found</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '6px' }}>{scanResult.product.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--c-ink-2)', marginTop: '4px' }}>₹{scanResult.product.price} · Stock: {scanResult.product.stock}</div>
                      {scanResult.product.batchNumber && <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>Batch: {scanResult.product.batchNumber}</div>}
                      {scanResult.product.expiryDate && <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>Expiry: {scanResult.product.expiryDate}</div>}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--c-warning-soft)', border: '1px solid var(--c-warning)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ color: 'var(--c-warning-strong)', fontWeight: 800 }}>New barcode — not in inventory</div>
                      <button onClick={() => { onScanToAdd?.(scanResult.code); onClose(); }} style={{ marginTop: '10px', padding: '10px 16px', background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                        ➕ Add as new product
                      </button>
                    </div>
                  )}
                  <button onClick={() => setScanResult(null)} style={{ marginTop: '14px', padding: '8px 16px', background: 'var(--c-line-soft)', border: '1px solid var(--c-line-strong)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Scan another</button>
                </div>
              )}
            </div>
          )}

          {/* ─── PRINT LABELS ─── */}
          {tab === 'print' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-ink-2)', display: 'block', marginBottom: '6px' }}>Label format</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[{ k: 'a4', label: 'A4 Sheet (3-up grid)' }, { k: 'thermal', label: 'Thermal (58×40mm)' }].map(o => (
                      <button key={o.k} onClick={() => changeLabelFormat(o.k)} style={{ flex: 1, padding: '10px', border: labelFormat === o.k ? '2px solid var(--c-primary)' : '1px solid var(--c-line-strong)', background: labelFormat === o.k ? 'var(--c-primary-soft)' : 'var(--c-surface)', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: labelFormat === o.k ? 'var(--c-primary)' : 'var(--c-ink-2)' }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--c-ink-2)', marginBottom: '14px' }}>
                {selectedProducts.length
                  ? `${selectedProducts.filter(p => p.barcode).length} label(s) ready to print`
                  : 'Select products in the "Manage & Generate" tab first, then come back here to print.'}
              </div>

              {/* Label preview grid */}
              <div style={{ display: 'grid', gridTemplateColumns: labelFormat === 'a4' ? 'repeat(auto-fill,minmax(160px,1fr))' : '1fr', gap: '10px', marginBottom: '20px' }}>
                {selectedProducts.filter(p => p.barcode).map(p => {
                  const fmt     = fmtFor(p);
                  const discPct = discFor(p);
                  const mrp     = Number(p.price) || 0;
                  const saleAmt = discPct > 0 ? Math.round(mrp * (1 - discPct / 100)) : null;

                  return (
                    <div key={p.id} style={{ border: '1px dashed var(--c-line-strong)', borderRadius: '8px', padding: '8px', textAlign: 'center', background: 'var(--c-surface)' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-ink-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{shopName}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{p.name}</div>
                      <Barcode value={p.barcode} format={fmt} height={34} width={1.2} fontSize={10} margin={2} renderer="svg" />
                      {saleAmt != null ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '9px', color: '#888', fontWeight: 700 }}>MRP</span>
                            <span style={{ fontSize: '11px', textDecoration: 'line-through', color: '#999' }}>₹{mrp}</span>
                            <span style={{ background: 'var(--c-danger)', color: 'var(--c-surface)', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px' }}>{discPct}% OFF</span>
                          </div>
                          <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--c-success-strong)' }}>₹{saleAmt}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>₹{mrp}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handlePrint}
                disabled={!selectedProducts.filter(p => p.barcode).length}
                style={{ width: '100%', padding: '14px', background: selectedProducts.filter(p => p.barcode).length ? 'linear-gradient(135deg,var(--c-primary),var(--c-violet))' : 'var(--c-line-strong)', color: 'var(--c-surface)', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={18} /> Print {selectedProducts.filter(p => p.barcode).length} Label{selectedProducts.filter(p => p.barcode).length !== 1 ? 's' : ''} ({labelFormat === 'a4' ? 'A4' : 'Thermal'})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
