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
import { ArrowLeft, Truck, Plus, X, Wifi, WifiOff, RefreshCw, CheckCircle2, Receipt } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import vanQueue from '../../lib/vanBillingQueue';

export default function FieldVanBilling() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [v, s] = await Promise.all([fieldApi.getVehicles(user.id), fieldApi.getRoutableShops(user.id)]);
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
  }, [user?.id]);

  const refreshPendingCount = useCallback(() => {
    if (!vehicleId) return;
    setPendingCount(vanQueue.getPendingInvoices(vehicleId).length);
    setSeriesState(vanQueue.getSeriesState(vehicleId));
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
      const state = await vanQueue.primeSeries(vehicleId);
      setSeriesState(state);
      toast.success(`Ready to bill — starting from invoice #${state.lastNo + 1}. Works offline from here.`);
    } catch (e) {
      toast.error(e.message || 'Could not prepare billing — needs a connection once, at the start of the day');
    } finally { setPriming(false); }
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await vanQueue.syncPendingInvoices(vehicleId);
      if (r.failed === 0) toast.success(`${r.ok} invoice${r.ok === 1 ? '' : 's'} synced`);
      else toast.warn(`${r.ok} synced · ${r.failed} still failing — will retry`);
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
        distributorId: user.id,
        shopId, repId: user.id,
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

  const S = {
    input: { width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

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
              {pendingCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    {pendingCount} invoice{pendingCount === 1 ? '' : 's'} not yet synced
                  </span>
                  <button onClick={doSync} disabled={syncing || !isOnline}
                    style={{ background: isOnline ? '#B45309' : '#CBD5E1', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: isOnline ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <RefreshCw size={11} /> {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>
              )}

              {lastReceipt && (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
