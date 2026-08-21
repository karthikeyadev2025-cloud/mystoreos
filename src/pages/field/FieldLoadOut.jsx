// ═══════════════════════════════════════════════════════════════════
// LOAD-OUT — moving stock from a depot onto a van
//
// Two-step by design: the depot builds the load (status 'pending'),
// then it's confirmed, which is when stock actually moves. That
// mirrors how it works physically — someone loads the van, someone
// signs for what's on it. Applying on creation would lose that.
//
// Quantities are entered in the product's own selling unit (boxes,
// jars) but ALWAYS stored in base units, so a van's stock ledger
// doesn't depend on how someone happened to type it in.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { Truck, ArrowLeft, Plus, X, Check, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function FieldLoadOut() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [lines, setLines] = useState([]);
  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickInBoxes, setPickInBoxes] = useState(true);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [w, p, t] = await Promise.all([
          fieldApi.getWarehouses(distId),
          fieldApi.getTransferableProducts(distId),
          fieldApi.getTransfers(distId, { limit: 20 }),
        ]);
        if (cancelled) return;
        setWarehouses(w); setProducts(p); setTransfers(t);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const depots = warehouses.filter(w => w.type === 'main');
  const vans = warehouses.filter(w => w.type === 'van');
  const selectedProduct = products.find(p => p.id === pickProduct);
  // Only offer the box toggle when the product actually has a pack
  // size — otherwise "boxes" is meaningless for it.
  const canUseBoxes = !!selectedProduct?.packSize;

  const addLine = () => {
    if (!pickProduct) return toast.error('Pick a product');
    const qty = parseFloat(pickQty);
    if (!qty || qty <= 0) return toast.error('Enter a quantity');

    const useBoxes = canUseBoxes && pickInBoxes;
    const qtyBase = useBoxes ? qty * selectedProduct.packSize : qty;

    setLines(prev => {
      // Merge rather than duplicate — two entries for the same product
      // would be confusing on the printed load sheet.
      const existing = prev.find(l => l.productId === pickProduct);
      if (existing) {
        return prev.map(l => l.productId === pickProduct
          ? { ...l, qtyBase: l.qtyBase + qtyBase } : l);
      }
      return [...prev, {
        productId: pickProduct,
        productName: selectedProduct.name,
        packSize: selectedProduct.packSize,
        unit: selectedProduct.unit,
        qtyBase,
      }];
    });
    setPickQty('');
  };

  const removeLine = (productId) => setLines(prev => prev.filter(l => l.productId !== productId));

  const submitLoad = async () => {
    setBusy(true);
    try {
      await fieldApi.createTransfer(distId, {
        fromWarehouseId: fromId, toWarehouseId: toId, kind: 'load_out',
        lines: lines.map(l => ({ productId: l.productId, qtyBase: l.qtyBase })),
      });
      toast.success('Load-out created — confirm it below once the van is physically loaded');
      setLines([]);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not create load-out');
    } finally { setBusy(false); }
  };

  const confirm = async (id) => {
    setBusy(true);
    try {
      await fieldApi.confirmTransfer(id);
      toast.success('Stock moved onto the van');
      reload();
    } catch (e) {
      // Surfaces the real reason — usually insufficient depot stock,
      // which is exactly what the operator needs to see.
      toast.error(e.message || 'Could not confirm');
    } finally { setBusy(false); }
  };

  const describe = (l) => l.packSize
    ? `${l.qtyBase} ${l.unit || 'units'} (${(l.qtyBase / l.packSize).toFixed(l.qtyBase % l.packSize === 0 ? 0 : 2)} boxes)`
    : `${l.qtyBase} ${l.unit || 'units'}`;

  const S = {
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    input: { width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 },
    h2: { fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: 8 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>
      <button onClick={() => navigate('/field/stock')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16, padding: '0 0 0 16px' }}>
        Stock Overview →
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>Van Load-Out</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 24px' }}>
        Build the morning load, then confirm once the van is physically loaded. Stock only moves on confirmation.
      </p>

      {vans.length === 0 || depots.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-warning-strong)', background: 'var(--c-warning-soft)', border: '1px solid var(--c-accent-border)' }}>
          You need at least one depot and one van before you can create a load-out.
          <div style={{ marginTop: 12 }}>
            <button onClick={() => navigate('/field/setup')} style={{ background: 'var(--c-warning-strong)', color: 'var(--c-surface)', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Go to Field Setup
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ ...S.card, marginBottom: 20 }}>
            <h2 style={S.h2}><Truck size={18} color="var(--c-success-strong)" /> New Load-Out</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
              <div>
                <label style={S.label}>From depot</label>
                <select value={fromId} onChange={e => setFromId(e.target.value)} style={S.input}>
                  <option value="">— select —</option>
                  {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>To van</label>
                <select value={toId} onChange={e => setToId(e.target.value)} style={S.input}>
                  <option value="">— select —</option>
                  {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={S.label}>Product</label>
                  <select value={pickProduct} onChange={e => setPickProduct(e.target.value)} style={S.input}>
                    <option value="">— select —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Quantity</label>
                  <input type="number" min="0" step="any" value={pickQty} onChange={e => setPickQty(e.target.value)} placeholder="0" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>In</label>
                  <select value={canUseBoxes && pickInBoxes ? 'box' : 'base'}
                    onChange={e => setPickInBoxes(e.target.value === 'box')}
                    disabled={!canUseBoxes} style={{ ...S.input, width: 110, opacity: canUseBoxes ? 1 : 0.5 }}>
                    {canUseBoxes && <option value="box">Boxes</option>}
                    <option value="base">{selectedProduct?.unit || 'Units'}</option>
                  </select>
                </div>
                <button onClick={addLine} style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  <Plus size={13} style={{ verticalAlign: -2 }} />
                </button>
              </div>
              {canUseBoxes && pickInBoxes && pickQty > 0 && (
                <p style={{ fontSize: 11, color: 'var(--c-success-strong)', margin: '6px 0 0', fontWeight: 600 }}>
                  = {parseFloat(pickQty) * selectedProduct.packSize} {selectedProduct.unit || 'units'}
                </p>
              )}
            </div>

            {lines.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {lines.map(l => (
                  <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-ink)' }}>{l.productName}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>{describe(l)}</div>
                    </div>
                    <button onClick={() => removeLine(l.productId)} style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger-strong)', border: '1px solid var(--c-danger-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={submitLoad} disabled={busy || !fromId || !toId}
                  style={{ width: '100%', marginTop: 10, background: (!fromId || !toId) ? 'var(--c-line-strong)' : 'var(--c-success-strong)', color: 'var(--c-surface)', border: 'none', padding: 12, borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: (!fromId || !toId) ? 'default' : 'pointer' }}>
                  {busy ? 'Creating…' : `Create Load-Out (${lines.length} product${lines.length === 1 ? '' : 's'})`}
                </button>
              </div>
            )}
          </div>

          <div style={S.card}>
            <h2 style={S.h2}><Clock size={18} color="var(--c-primary)" /> Recent Transfers</h2>
            {transfers.length === 0 ? (
              <p style={{ color: 'var(--c-faint)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No transfers yet.</p>
            ) : (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transfers.map(t => (
                  <div key={t.id} style={{ border: '1px solid var(--c-line)', borderRadius: 10, padding: 14, background: t.status === 'pending' ? 'var(--c-warning-soft)' : 'var(--c-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-ink)' }}>
                          {t.fromName} → {t.toName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                          {t.lines.length} product{t.lines.length === 1 ? '' : 's'} · {new Date(t.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--c-ink-2)', marginTop: 6 }}>
                          {t.lines.map(l => `${l.productName} × ${l.qtyBase}`).join(' · ')}
                        </div>
                      </div>
                      {t.status === 'pending' ? (
                        <button onClick={() => confirm(t.id)} disabled={busy}
                          style={{ background: 'var(--c-success-strong)', color: 'var(--c-surface)', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <Check size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Confirm
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: t.status === 'confirmed' ? 'var(--c-success-strong)' : 'var(--c-danger-strong)', background: t.status === 'confirmed' ? 'var(--c-success-soft)' : 'var(--c-danger-soft)', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {t.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
