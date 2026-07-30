import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { api } from '../lib/api';
import { X, ArrowRight, Loader2, Package, Plus, Minus } from 'lucide-react';

// Move stock between two branches of the same brand. Owner picks source
// branch + target branch + which products + qty for each, then submits.
//
// Lifecycle:
//   1. Mount → load owner's branches (main + active branches)
//   2. Owner picks source → load source's products with stock > 0
//   3. Owner picks target (different from source)
//   4. Owner adjusts qty for each product they want to move
//   5. Submit → api.createStockTransfer → success toast + close
//
// Edge cases handled:
//   • If source has no products with stock — empty state with explanation
//   • If owner picks same shop for source + target — submit button disabled
//   • If no qty set — submit button disabled until at least one item picked
//   • API failures → toast with the error message, modal stays open so
//     the owner can adjust quantities and retry.

export default function StockTransferModal({ ownerId, branches, onClose, onComplete }) {
  // Only branches owned by this user (main + non-deleted) are pickable.
  // The branches prop already arrived filtered from BranchesManager.
  const eligibleBranches = useMemo(() => branches.filter(b => !b.branchDeletedAt), [branches]);

  const [fromShopId, setFromShopId] = useState(eligibleBranches[0]?.id || '');
  const [toShopId, setToShopId] = useState('');
  const [sourceProducts, setSourceProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  // Qty being transferred per product. Map<productId, integer>.
  const [qtyMap, setQtyMap] = useState({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load source's products whenever the source picker changes. Stock=0
  // products are excluded — moving nothing serves no purpose.
  useEffect(() => {
    if (!fromShopId) { queueMicrotask(() => setSourceProducts([])); return; }
    let cancelled = false;
    queueMicrotask(() => { setLoadingProducts(true); setQtyMap({}); });   // reset selections — source changed
    (async () => {
      try {
        const list = await api.getShopProducts(fromShopId);
        if (cancelled) return;
        setSourceProducts((list || []).filter(p => Number(p.stock || 0) > 0));
      } catch (err) {
        console.error('Failed loading source products', err);
        toast.error('Could not load products from source branch');
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromShopId]);

  // Default the target picker to "the other branch" if there are
  // exactly two eligible branches — saves one tap in the most common case.
  useEffect(() => {
    queueMicrotask(() => {
      if (!toShopId && fromShopId && eligibleBranches.length === 2) {
        const other = eligibleBranches.find(b => b.id !== fromShopId);
        if (other) setToShopId(other.id);
      }
    });
  }, [fromShopId, toShopId, eligibleBranches]);

  const selectedItems = useMemo(() =>
    Object.entries(qtyMap)
      .filter(([, q]) => q > 0)
      .map(([productId, qty]) => {
        const p = sourceProducts.find(x => x.id === productId);
        return { productId, qty, productName: p?.name || '', stock: p?.stock || 0 };
      }),
    [qtyMap, sourceProducts]
  );

  const totalQty = selectedItems.reduce((s, x) => s + x.qty, 0);
  const totalProducts = selectedItems.length;
  const sameShopError = fromShopId && toShopId && fromShopId === toShopId;
  const canSubmit = !!fromShopId && !!toShopId && !sameShopError && totalProducts > 0 && !submitting;

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sourceProducts;
    return sourceProducts.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }, [sourceProducts, searchTerm]);

  const setQty = (productId, qty) => {
    const stock = sourceProducts.find(p => p.id === productId)?.stock || 0;
    const clamped = Math.max(0, Math.min(stock, parseInt(qty, 10) || 0));
    setQtyMap(prev => {
      if (clamped === 0) {
        const { [productId]: _ignore, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: clamped };
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await api.createStockTransfer({
        fromShopId,
        toShopId,
        items: selectedItems.map(({ productId, qty, productName }) => ({ productId, qty, productName })),
        ownerId,
        note: note.trim() || null,
      });
      if (result.status === 'completed') {
        toast.success(`Transferred ${totalQty} unit${totalQty === 1 ? '' : 's'} across ${totalProducts} product${totalProducts === 1 ? '' : 's'}`);
      } else if (result.status === 'partial') {
        toast.warn(`Transferred partially — ${result.failures.length} item(s) had issues. Check the transfer voucher.`);
      } else {
        toast.error('Transfer failed for all items. Check stock counts and try again.');
      }
      onComplete?.(result);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Stock transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 0, maxWidth: 620, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={17} style={{ color: '#4F46E5' }} /> Transfer Stock Between Branches
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#64748B' }}>
              Move inventory atomically + record a voucher for your audit trail.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {/* From/To pickers */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 0.3, marginBottom: 5 }}>FROM</label>
              <select
                value={fromShopId}
                onChange={e => setFromShopId(e.target.value)}
                style={inputStyle}
              >
                {eligibleBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}{!b.parentShopId ? ' (Main)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: 'center', paddingBottom: 8, color: '#4F46E5' }}>
              <ArrowRight size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 0.3, marginBottom: 5 }}>TO</label>
              <select
                value={toShopId}
                onChange={e => setToShopId(e.target.value)}
                style={{ ...inputStyle, borderColor: sameShopError ? '#DC2626' : '#E2E8F0' }}
              >
                <option value="">— Pick destination —</option>
                {eligibleBranches.filter(b => b.id !== fromShopId).map(b => (
                  <option key={b.id} value={b.id}>{b.name}{!b.parentShopId ? ' (Main)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          {sameShopError && (
            <div style={{ fontSize: 11.5, color: '#DC2626', marginBottom: 10, padding: '6px 10px', background: '#FEF2F2', borderRadius: 7 }}>
              Pick two DIFFERENT branches.
            </div>
          )}

          {/* Product list */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 0.3, marginBottom: 5 }}>PRODUCTS · {totalProducts} picked, {totalQty} units</label>
            <input
              type="text"
              placeholder="Search products by name or barcode…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 9, maxHeight: 280, overflowY: 'auto' }}>
              {loadingProducts ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading source products…
                </div>
              ) : filteredProducts.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                  {sourceProducts.length === 0
                    ? 'Source branch has no products in stock to transfer.'
                    : `No products match "${searchTerm}".`}
                </div>
              ) : (
                filteredProducts.map(p => {
                  const q = qtyMap[p.id] || 0;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
                          Stock: <b style={{ color: q > 0 ? '#4F46E5' : '#475569' }}>{p.stock}</b>
                          {p.barcode ? ` · ${p.barcode}` : ''}
                          {q > 0 && <span style={{ color: '#16A34A', fontWeight: 700 }}> · sending {q}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => setQty(p.id, q - 1)}
                          disabled={q <= 0}
                          style={qtyBtnStyle(q <= 0)}
                        ><Minus size={13} /></button>
                        <input
                          type="number"
                          value={q || ''}
                          onChange={e => setQty(p.id, e.target.value)}
                          placeholder="0"
                          min={0}
                          max={p.stock}
                          style={{ width: 56, padding: '5px 6px', textAlign: 'center', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 12.5, fontWeight: 700 }}
                        />
                        <button
                          onClick={() => setQty(p.id, q + 1)}
                          disabled={q >= p.stock}
                          style={qtyBtnStyle(q >= p.stock)}
                        ><Plus size={13} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 0.3, marginBottom: 5 }}>NOTE (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. weekly resupply, missing stock from Main"
              maxLength={140}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: 'none', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              flex: 2,
              background: canSubmit ? 'linear-gradient(135deg,#4F46E5,#4338CA)' : '#94A3B8',
              color: '#fff',
              border: 'none',
              padding: '11px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 800,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Transferring…' : (totalProducts === 0 ? 'Pick products to transfer' : `Transfer ${totalQty} units →`)}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid #E2E8F0',
  borderRadius: 9,
  fontSize: 13,
  color: '#0F172A',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const qtyBtnStyle = (disabled) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7,
  background: disabled ? '#F1F5F9' : '#EEF2FF',
  color: disabled ? '#94A3B8' : '#4F46E5',
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
});
