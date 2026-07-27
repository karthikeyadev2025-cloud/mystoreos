// ═══════════════════════════════════════════════════════════════════
// DIRECT SALE — the distributor selling from the counter or the phone
//
// This was the biggest hole in the distributor panel: a distributor
// could only ever FULFIL orders a shop placed through the app, or that
// a rep booked in the field. If a shop phoned the godown — which is how
// most of this business actually happens — there was no way to enter
// that order at all. It fell to a paper pad and left the system
// entirely: no invoice, no dispatch tracking, no ledger entry, nothing
// in the reports.
//
// Sells to a linked shop OR any walk-in customer, produces a real GST
// invoice, and lands in the same dispatch pipeline the dashboard
// already handles — so it needs no new dispatch UI at all.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Plus, X, Receipt, CheckCircle2, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';
import { printInvoice } from '../../lib/invoicePrint';
import { UNIT_SUFFIX } from '../../lib/units';

export default function DirectSale() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const distId = distributorIdOf(user);

  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [shopId, setShopId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [cart, setCart] = useState([]);
  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.getDistributorProducts(distId),
          fieldApi.getRoutableShops(distId),
        ]);
        if (cancelled) return;
        setProducts(p || []); setShops(s || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  const selected = products.find(p => p.id === pickProduct);

  const addLine = () => {
    if (!pickProduct) return toast.error('Pick a product');
    const qty = parseFloat(pickQty);
    // Rate defaults to the catalog price but stays editable — a
    // distributor negotiates per customer, and forcing catalog price
    // would make this unusable for real deals.
    const rate = parseFloat(pickRate) || selected?.price || 0;
    if (!qty || qty <= 0) return toast.error('Enter quantity');
    if (rate <= 0) return toast.error('Enter a rate');
    setCart(prev => {
      const found = prev.find(l => l.id === pickProduct);
      if (found) return prev.map(l => l.id === pickProduct ? { ...l, qty: l.qty + qty } : l);
      return [...prev, {
        id: pickProduct, name: selected.name, qty, price: rate,
        hsn: selected.hsnCode || '', gstPct: selected.gstRate || 0,
        sku: selected.sku || '', unit: selected.unit || '', packSize: selected.packSize || null,
      }];
    });
    setPickQty(''); setPickRate('');
  };

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async () => {
    if (!shopId && !custName.trim()) return toast.error('Select a shop or enter the customer name');
    if (!shopId && payMode === 'credit') return toast.error('Credit needs a linked shop — take cash or UPI');
    if (cart.length === 0) return toast.error('Add at least one product');
    setBusy(true);
    try {
      await api.createDirectSale(distId, {
        shopId: shopId || null,
        customerName: shopId ? '' : custName.trim(),
        customerPhone: shopId ? '' : custPhone.trim(),
        items: cart.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, unit: l.unit })),
        total, paymentMode: payMode,
      });
      setLastSale({
        buyer: shopId ? shops.find(s => s.id === shopId)?.name : custName.trim(),
        phone: shopId ? '' : custPhone.trim(),
        lines: cart, total, payMode, at: new Date().toISOString(),
      });
      toast.success(`Sale recorded · ₹${total.toLocaleString('en-IN')} — ready to dispatch`);
      setCart([]); setShopId(''); setCustName(''); setCustPhone('');
    } catch (e) {
      toast.error(e.message || 'Could not record sale');
    } finally { setBusy(false); }
  };

  // Same invoice engine and template choice as van sales, so a counter
  // sale and a van sale produce an identical-looking document.
  const printBill = () => {
    if (!lastSale) return;
    const hasGstin = !!(user?.gstin && String(user.gstin).trim());
    printInvoice(hasGstin ? 'gst_tax' : 'wholesale', {
      shopName: user?.name || 'Distributor',
      shopPhone: user?.phone || '',
      shopAddress: user?.businessAddress || '',
      shopGSTIN: user?.gstin || '',
      logoUrl: user?.logo || '',
      billNo: `DS-${Date.now().toString().slice(-6)}`,
      dateStr: new Date(lastSale.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      modeTitle: hasGstin ? 'Tax Invoice' : 'Invoice',
      customerName: lastSale.buyer || 'Customer',
      customerPhone: lastSale.phone || '',
      items: lastSale.lines.map(l => {
        const pack = l.packSize || null;
        const boxes = pack && l.qty % pack === 0 ? l.qty / pack : null;
        return {
          code: l.sku || '', name: l.name, hsn: l.hsn || '',
          jars: boxes != null ? pack : null, boxes,
          qty: l.qty, unit: l.unit ? (UNIT_SUFFIX[l.unit] || l.unit) : '',
          rate: l.price, gstPct: l.gstPct || 0,
        };
      }),
      subtotal: lastSale.total, discountAmount: 0, roundOff: 0, total: lastSale.total,
      paymentMode: lastSale.payMode,
      footerNote: 'Thank you for your business.',
      termsNote: 'Goods once sold are governed by standard trade terms.',
    }, 'a4');
  };

  const S = {
    card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18, marginBottom: 14 },
    input: { width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 14, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>New Sale</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        Take an order at the counter or over the phone. Invoice it, then dispatch from your Orders tab as usual.
      </p>

      {lastSale && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <CheckCircle2 size={16} color="#059669" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>
              {lastSale.buyer} · ₹{lastSale.total.toLocaleString('en-IN')} · ready to dispatch
            </span>
          </div>
          <button onClick={printBill}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Receipt size={12} /> Print Invoice
          </button>
        </div>
      )}

      <div style={S.card}>
        <label style={S.label}>Customer</label>
        <select value={shopId} onChange={e => { setShopId(e.target.value); if (e.target.value) { setCustName(''); setCustPhone(''); } }}
          style={{ ...S.input, marginBottom: shopId ? 0 : 8 }}>
          <option value="">— walk-in / not listed —</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {!shopId && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer / shop name" style={S.input} />
            <input value={custPhone} onChange={e => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Phone (optional)" style={S.input} />
          </div>
        )}
      </div>

      <div style={S.card}>
        <label style={S.label}>Product</label>
        <select value={pickProduct}
          onChange={e => {
            setPickProduct(e.target.value);
            const p = products.find(x => x.id === e.target.value);
            setPickRate(p?.price ? String(p.price) : '');
          }}
          style={{ ...S.input, marginBottom: 8 }}>
          <option value="">— select —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" inputMode="decimal" value={pickQty} onChange={e => setPickQty(e.target.value)} placeholder="Qty" style={S.input} />
          <input type="number" inputMode="decimal" value={pickRate} onChange={e => setPickRate(e.target.value)} placeholder="Rate ₹" style={S.input} />
          <button onClick={addLine} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 16px', borderRadius: 9, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={16} />
          </button>
        </div>
        {selected?.packSize && (
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
            {selected.packSize} {selected.unit || 'units'} per box — enter total units; the invoice shows the box breakdown.
          </p>
        )}
      </div>

      {cart.length > 0 && (
        <div style={S.card}>
          {cart.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {l.qty} {l.unit || 'units'} × ₹{l.price} = ₹{(l.qty * l.price).toLocaleString('en-IN')}
                  {l.packSize && l.qty % l.packSize === 0 && ` · ${l.qty / l.packSize} box${l.qty / l.packSize === 1 ? '' : 'es'}`}
                </div>
              </div>
              <button onClick={() => setCart(c => c.filter(x => x.id !== l.id))}
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            </div>
          ))}

          <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', textAlign: 'right', margin: '12px 0' }}>
            ₹{total.toLocaleString('en-IN')}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['cash', 'upi', 'credit'].map(m => {
              // Credit needs a real account to owe against, so it's
              // disabled for walk-ins rather than failing on submit.
              const blocked = m === 'credit' && !shopId;
              return (
                <button key={m} disabled={blocked} onClick={() => !blocked && setPayMode(m)}
                  title={blocked ? 'Credit needs a linked shop' : ''}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                    border: `1px solid ${payMode === m ? '#4F46E5' : '#E2E8F0'}`,
                    background: payMode === m ? '#EEF2FF' : '#fff',
                    color: payMode === m ? '#4338CA' : '#64748B',
                    opacity: blocked ? 0.4 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}>
                  {m}
                </button>
              );
            })}
          </div>

          <button onClick={submit} disabled={busy}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ShoppingCart size={16} /> {busy ? 'Recording…' : 'Record Sale'}
          </button>
        </div>
      )}
    </div>
  );
}
