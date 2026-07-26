// ═══════════════════════════════════════════════════════════════════
// VAN BILLING — spot sales off the van
//
// This is where offline actually matters. The rest of Field Mode can
// assume a connection; this cannot. Every action here must work with
// zero signal, because that's the actual condition it's used in.
//
// The product list is the VAN's own stock (via getWarehouseStock on
// the van's warehouse), not the full catalog — a rep can only sell
// what's physically on the vehicle.
//
// Checkout is synchronous and local: allocate the number, save the
// sale, done. No network call is on the critical path of a sale
// completing — sync happens separately, whenever connectivity allows.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Truck, Plus, X, Wifi, WifiOff, RefreshCw, CheckCircle2, Receipt, RotateCcw, Camera } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf, actorIdOf } from '../../lib/fieldIdentity';
import vanQueue from '../../lib/vanBillingQueue';
import { validateImageFile } from '../../lib/fileValidation';
import { getDistCaps } from '../../lib/features';

const RETURN_REASONS = [
  { v: 'expired', l: 'Expired' },
  { v: 'near_expiry', l: 'Near-expiry' },
  { v: 'damaged', l: 'Damaged' },
  { v: 'unsold_seasonal', l: 'Unsold seasonal' },
  { v: 'wrong_delivery', l: 'Wrong delivery' },
];

export default function FieldVanBilling() {
  const { user } = useAuth();
  // Business context vs who is doing the selling. An invoice must
  // belong to the DISTRIBUTOR but record the REP who raised it.
  const distId = distributorIdOf(user);
  const actorId = actorIdOf(user);
  const navigate = useNavigate();
  const caps = getDistCaps(user);

  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [stock, setStock] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priming, setPriming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seriesState, setSeriesState] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [shopId, setShopId] = useState('');
  const [cart, setCart] = useState([]);
  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [lastReceipt, setLastReceipt] = useState(null);

  // 'sell' or 'return' — same screen, since a rep switches between
  // them constantly at the same shop counter, and forcing a separate
  // page for returns would mean re-selecting the shop every time.
  const [mode, setMode] = useState('sell');
  const [returnPendingCount, setReturnPendingCount] = useState(0);
  const [returnReason, setReturnReason] = useState('expired');
  const [returnCart, setReturnCart] = useState([]);
  const [returnPickProduct, setReturnPickProduct] = useState('');
  const [returnPickQty, setReturnPickQty] = useState('');
  const [returnPickRate, setReturnPickRate] = useState('');
  const [lastReturnReceipt, setLastReturnReceipt] = useState(null);
  const [returnPhoto, setReturnPhoto] = useState('');

  // Same resize/compress-to-base64 pattern already proven for logo
  // upload elsewhere — no new upload infrastructure needed. Damaged-
  // goods proof genuinely needs a photo; other reasons don't require
  // one but can still attach it.
  const captureReturnPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast.error(check.reason); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(600 / img.width, 600 / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setReturnPhoto(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [v, s] = await Promise.all([fieldApi.getVehicles(distId), fieldApi.getRoutableShops(distId)]);
        if (cancelled) return;
        setVehicles(v); setShops(s);
        if (v.length === 1) setVehicleId(v[0].id);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  const refreshPendingCount = useCallback(() => {
    if (!vehicleId) return;
    setPendingCount(vanQueue.getPendingInvoices(vehicleId).length);
    setSeriesState(vanQueue.getSeriesState(vehicleId));
    setReturnPendingCount(vanQueue.getPendingReturns(vehicleId).length);
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      refreshPendingCount();
      const wh = vehicles.find(v => v.id === vehicleId)?.warehouseId;
      if (!wh) return;
      try {
        const data = await fieldApi.getWarehouseStock(wh);
        if (!cancelled) setStock(data);
      } catch {
        if (!cancelled) setStock([]);
      }
    })();
    return () => { cancelled = true; };
  }, [vehicleId, vehicles, refreshPendingCount]);

  const doPrime = async () => {
    setPriming(true);
    try {
      const [state] = await Promise.all([
        vanQueue.primeSeries(vehicleId),
        vanQueue.primeReturnSeries(vehicleId),
      ]);
      setSeriesState(state);
      toast.success(`Ready to bill — starting from invoice #${state.lastNo + 1}. Works offline from here.`);
    } catch (e) {
      toast.error(e.message || 'Could not prepare billing — needs a connection once, at the start of the day');
    } finally { setPriming(false); }
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const [ri, rr] = await Promise.all([
        vanQueue.syncPendingInvoices(vehicleId),
        vanQueue.syncPendingReturns(vehicleId),
      ]);
      const totalOk = ri.ok + rr.ok;
      const totalFailed = ri.failed + rr.failed;
      if (totalFailed === 0 && totalOk > 0) toast.success(`${totalOk} synced`);
      else if (totalFailed > 0) toast.warn(`${totalOk} synced · ${totalFailed} still failing — will retry`);
      refreshPendingCount();
    } catch (e) {
      toast.error(e.message || 'Sync failed — will retry when connection improves');
    } finally { setSyncing(false); }
  };

  const selectedStock = stock.find(s => s.productId === pickProduct);

  const addToCart = () => {
    if (!pickProduct) return toast.error('Pick a product');
    const qty = parseFloat(pickQty);
    const rate = parseFloat(pickRate);
    if (!qty || qty <= 0) return toast.error('Enter quantity');
    if (!rate || rate <= 0) return toast.error('Enter rate');
    const already = cart.filter(l => l.productId === pickProduct).reduce((s, l) => s + l.qtyBase, 0);
    if (selectedStock && already + qty > selectedStock.qtyBase) {
      return toast.error(`Only ${selectedStock.qtyBase - already} left on this van`);
    }
    setCart(prev => {
      const found = prev.find(l => l.productId === pickProduct);
      if (found) return prev.map(l => l.productId === pickProduct ? { ...l, qtyBase: l.qtyBase + qty } : l);
      return [...prev, { productId: pickProduct, name: selectedStock.productName, qtyBase: qty, rate }];
    });
    setPickQty(''); setPickRate('');
  };

  const total = cart.reduce((s, l) => s + l.rate * l.qtyBase, 0);

  // The one function that must never touch the network on its
  // critical path. Number allocation and the local save are both
  // synchronous — this completes instantly regardless of signal.
  const completeSale = () => {
    if (!shopId) return toast.error('Pick the shop');
    if (cart.length === 0) return toast.error('Cart is empty');

    try {
      const { invoiceNo, invoiceRef } = vanQueue.allocateInvoiceNumber(vehicleId);
      const invoice = {
        distributorId: distId,
        shopId, repId: actorId,
        invoiceNo, invoiceRef,
        issuedAt: new Date().toISOString(),
        total, paymentMode, amountPaid: total,
        lines: cart.map(l => ({ product_id: l.productId, qty_base: l.qtyBase, rate: l.rate })),
      };
      vanQueue.queueInvoice(vehicleId, invoice);

      // Reflect the sale in on-screen stock immediately — the server
      // decrement happens on sync, but a rep with zero connectivity
      // for the rest of the day still needs a correct running total.
      setStock(prev => prev.map(s => {
        const sold = cart.find(l => l.productId === s.productId);
        return sold ? { ...s, qtyBase: s.qtyBase - sold.qtyBase } : s;
      }));

      setLastReceipt({ ...invoice, shopName: shops.find(s => s.id === shopId)?.name, lines: cart });
      setCart([]); setShopId('');
      refreshPendingCount();
      toast.success(`${invoiceRef} — ₹${total.toLocaleString('en-IN')}`);
    } catch (e) {
      toast.error(e.message || 'Could not complete sale');
    }
  };

  const shareReceipt = () => {
    if (!lastReceipt) return;
    const lines = lastReceipt.lines.map(l => `${l.name} x${l.qtyBase} = ₹${(l.qtyBase * l.rate).toLocaleString('en-IN')}`).join('\n');
    const msg = `🧾 *${lastReceipt.invoiceRef}*\n${lastReceipt.shopName}\n\n${lines}\n\n*Total: ₹${lastReceipt.total.toLocaleString('en-IN')}*\nPaid via ${lastReceipt.paymentMode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── RETURNS ──────────────────────────────────────────────────────
  const addToReturnCart = () => {
    if (!returnPickProduct) return toast.error('Pick a product');
    const qty = parseFloat(returnPickQty);
    const rate = parseFloat(returnPickRate);
    if (!qty || qty <= 0) return toast.error('Enter quantity');
    if (!rate || rate <= 0) return toast.error('Enter rate');
    const prod = stock.find(s => s.productId === returnPickProduct) || { productName: 'Product' };
    setReturnCart(prev => {
      const found = prev.find(l => l.productId === returnPickProduct);
      if (found) return prev.map(l => l.productId === returnPickProduct ? { ...l, qtyBase: l.qtyBase + qty } : l);
      return [...prev, { productId: returnPickProduct, name: prod.productName, qtyBase: qty, rate }];
    });
    setReturnPickQty(''); setReturnPickRate('');
  };

  const returnTotal = returnCart.reduce((s, l) => s + l.rate * l.qtyBase, 0);

  // Same principle as completeSale: fully local and synchronous, no
  // network call on the critical path. A return is recorded and
  // credited on the spot regardless of signal.
  const completeReturn = () => {
    if (!shopId) return toast.error('Pick the shop');
    if (returnCart.length === 0) return toast.error('Add at least one item');

    try {
      const { creditNo, creditRef } = vanQueue.allocateCreditNoteNumber(vehicleId);
      const ret = {
        distributorId: distId,
        shopId, repId: actorId,
        creditNo, creditRef,
        issuedAt: new Date().toISOString(),
        reason: returnReason,
        totalCredit: returnTotal,
        lines: returnCart.map(l => ({ product_id: l.productId, qty_base: l.qtyBase, rate: l.rate })),
        photoUrl: returnPhoto || null,
      };
      vanQueue.queueReturn(vehicleId, ret);

      setLastReturnReceipt({ ...ret, shopName: shops.find(s => s.id === shopId)?.name, lines: returnCart });
      setReturnCart([]); setShopId(''); setReturnPhoto('');
      refreshPendingCount();
      toast.success(`${creditRef} — ₹${returnTotal.toLocaleString('en-IN')} credited`);
    } catch (e) {
      toast.error(e.message || 'Could not record return');
    }
  };

  const S = {
    input: { width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  // Van sales specifically is Enterprise — the rest of field
  // distribution (routes, presale, settlement) is Pro. Offline billing
  // is the genuinely heavyweight capability, so it's tiered separately
  // and the pricing page says exactly that.
  if (!caps.vanSales) {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <button onClick={() => navigate('/field/setup')}
          style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={15} /> Field Setup
        </button>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <Truck size={30} color="#B45309" style={{ marginBottom: 10 }} />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#92400E', margin: '0 0 6px' }}>Van Sales is an Enterprise feature</h2>
          <p style={{ fontSize: 13, color: '#78350F', margin: 0, lineHeight: 1.6 }}>
            Bill customers directly from the van with zero network connection, take returns
            on the spot, and sync everything when you're back in range.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", paddingBottom: 40 }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, color: '#0F172A', margin: 0 }}>Van Billing</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: isOnline ? '#059669' : '#B45309' }}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />} {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {vehicles.length === 0 ? (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: 18, textAlign: 'center', color: '#92400E', fontSize: 13 }}>
          No vans set up yet.
        </div>
      ) : (
        <>
          <select value={vehicleId} onChange={e => { setVehicleId(e.target.value); setSeriesState(null); }}
            style={{ ...S.input, marginBottom: 14, fontWeight: 700 }}>
            <option value="">— pick a van —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.code} · {v.warehouseName}</option>)}
          </select>

          {vehicleId && !seriesState && (
            <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 16, marginBottom: 14, textAlign: 'center' }}>
              <Truck size={22} color="#4F46E5" style={{ marginBottom: 6 }} />
              <p style={{ fontSize: 12, color: '#4338CA', margin: '0 0 10px' }}>
                One-time setup for today — needs a connection now, then billing works fully offline.
              </p>
              <button onClick={doPrime} disabled={priming}
                style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                {priming ? 'Preparing…' : 'Start Billing'}
              </button>
            </div>
          )}

          {vehicleId && seriesState && (
            <>
              {(pendingCount + returnPendingCount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    {pendingCount + returnPendingCount} document{(pendingCount + returnPendingCount) === 1 ? '' : 's'} not yet synced
                  </span>
                  <button onClick={doSync} disabled={syncing || !isOnline}
                    style={{ background: isOnline ? '#B45309' : '#CBD5E1', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: isOnline ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <RefreshCw size={11} /> {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMode('sell')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${mode === 'sell' ? '#4F46E5' : '#E2E8F0'}`,
                    background: mode === 'sell' ? '#EEF2FF' : '#fff', color: mode === 'sell' ? '#4338CA' : '#64748B' }}>
                  Sell
                </button>
                <button onClick={() => setMode('return')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: `1px solid ${mode === 'return' ? '#DC2626' : '#E2E8F0'}`,
                    background: mode === 'return' ? '#FEF2F2' : '#fff', color: mode === 'return' ? '#B91C1C' : '#64748B' }}>
                  <RotateCcw size={13} /> Return
                </button>
              </div>

              {mode === 'sell' && lastReceipt && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CheckCircle2 size={14} color="#059669" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>{lastReceipt.invoiceRef} · ₹{lastReceipt.total.toLocaleString('en-IN')}</span>
                  </div>
                  <button onClick={shareReceipt}
                    style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={12} /> Share Receipt
                  </button>
                </div>
              )}

              {mode === 'return' && lastReturnReceipt && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color="#B91C1C" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>{lastReturnReceipt.creditRef} · ₹{lastReturnReceipt.totalCredit.toLocaleString('en-IN')} credited</span>
                  </div>
                </div>
              )}

              {mode === 'sell' && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                <label style={S.label}>Shop</label>
                <select value={shopId} onChange={e => setShopId(e.target.value)} style={{ ...S.input, marginBottom: 12 }}>
                  <option value="">— select —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <label style={S.label}>Product (van stock)</label>
                <select value={pickProduct} onChange={e => { setPickProduct(e.target.value); setPickRate(''); }} style={{ ...S.input, marginBottom: 8 }}>
                  <option value="">— select —</option>
                  {stock.filter(s => s.qtyBase > 0).map(s => (
                    <option key={s.id} value={s.productId}>{s.productName} ({s.qtyBase} left)</option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input type="number" inputMode="decimal" value={pickQty} onChange={e => setPickQty(e.target.value)} placeholder="Qty" style={S.input} />
                  <input type="number" inputMode="decimal" value={pickRate} onChange={e => setPickRate(e.target.value)} placeholder="Rate ₹" style={S.input} />
                  <button onClick={addToCart} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
                    <Plus size={16} />
                  </button>
                </div>

                {cart.map(l => (
                  <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{l.qtyBase} × ₹{l.rate} = ₹{(l.qtyBase * l.rate).toLocaleString('en-IN')}</div>
                    </div>
                    <button onClick={() => setCart(c => c.filter(x => x.productId !== l.productId))}
                      style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {cart.length > 0 && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', textAlign: 'right', margin: '10px 0' }}>
                      ₹{total.toLocaleString('en-IN')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {['cash', 'upi', 'credit'].map(m => (
                        <button key={m} onClick={() => setPaymentMode(m)}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer',
                            border: `1px solid ${paymentMode === m ? '#4F46E5' : '#E2E8F0'}`,
                            background: paymentMode === m ? '#EEF2FF' : '#fff',
                            color: paymentMode === m ? '#4338CA' : '#64748B' }}>{m}</button>
                      ))}
                    </div>
                    <button onClick={completeSale}
                      style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                      Complete Sale
                    </button>
                  </>
                )}
              </div>
              )}

              {mode === 'return' && (
              <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 12, padding: 16 }}>
                <label style={S.label}>Shop</label>
                <select value={shopId} onChange={e => setShopId(e.target.value)} style={{ ...S.input, marginBottom: 12 }}>
                  <option value="">— select —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <label style={S.label}>Reason</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {RETURN_REASONS.map(r => (
                    <button key={r.v} onClick={() => setReturnReason(r.v)}
                      style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${returnReason === r.v ? '#DC2626' : '#E2E8F0'}`,
                        background: returnReason === r.v ? '#FEF2F2' : '#fff',
                        color: returnReason === r.v ? '#B91C1C' : '#64748B' }}>{r.l}</button>
                  ))}
                </div>

                <label style={S.label}>Product</label>
                <select value={returnPickProduct} onChange={e => { setReturnPickProduct(e.target.value); setReturnPickRate(''); }} style={{ ...S.input, marginBottom: 8 }}>
                  <option value="">— select —</option>
                  {stock.map(s => <option key={s.id} value={s.productId}>{s.productName}</option>)}
                </select>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input type="number" inputMode="decimal" value={returnPickQty} onChange={e => setReturnPickQty(e.target.value)} placeholder="Qty" style={S.input} />
                  <input type="number" inputMode="decimal" value={returnPickRate} onChange={e => setReturnPickRate(e.target.value)} placeholder="Rate ₹" style={S.input} />
                  <button onClick={addToReturnCart} style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
                    <Plus size={16} />
                  </button>
                </div>

                {(returnReason === 'damaged' || returnReason === 'expired') && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.label}>Photo proof {returnReason === 'damaged' ? '(recommended)' : '(optional)'}</label>
                    {returnPhoto ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={returnPhoto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #E2E8F0' }} />
                        <button onClick={() => setReturnPhoto('')} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed #E2E8F0', borderRadius: 10, padding: 12, cursor: 'pointer', color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                        <Camera size={16} /> Take Photo
                        <input type="file" accept="image/*" capture="environment" onChange={captureReturnPhoto} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                )}

                {returnCart.map(l => (
                  <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: '#B91C1C' }}>{l.qtyBase} × ₹{l.rate} = ₹{(l.qtyBase * l.rate).toLocaleString('en-IN')}</div>
                    </div>
                    <button onClick={() => setReturnCart(c => c.filter(x => x.productId !== l.productId))}
                      style={{ background: '#fff', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {returnCart.length > 0 && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#B91C1C', textAlign: 'right', margin: '10px 0' }}>
                      ₹{returnTotal.toLocaleString('en-IN')} credit
                    </div>
                    <button onClick={completeReturn}
                      style={{ width: '100%', background: '#DC2626', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                      Record Return &amp; Credit Shop
                    </button>
                  </>
                )}
              </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
