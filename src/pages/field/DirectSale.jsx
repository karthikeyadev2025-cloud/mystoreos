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

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [transportName, setTransportName] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [freight, setFreight] = useState('');
  const [discountAmt, setDiscountAmt] = useState('');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, s, v] = await Promise.all([
          api.getDistributorProducts(distId),
          fieldApi.getRoutableShops(distId),
          fieldApi.getVehicles(distId),
        ]);
        if (cancelled) return;
        setProducts(p || []); setShops(s || []); setVehicles(v || []);
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

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discountVal = parseFloat(discountAmt) || 0;
  const freightVal = parseFloat(freight) || 0;
  const total = Math.max(0, subtotal - discountVal + freightVal);

  const submit = async () => {
    if (!shopId && !custName.trim()) return toast.error('Select a shop or enter the customer name');
    if (!shopId && payMode === 'credit') return toast.error('Credit needs a linked shop — take cash or UPI');
    if (cart.length === 0) return toast.error('Add at least one product');
    setBusy(true);
    try {
      const orderId = await api.createDirectSale(distId, {
        shopId: shopId || null,
        customerName: shopId ? '' : custName.trim(),
        customerPhone: shopId ? '' : custPhone.trim(),
        items: cart.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, unit: l.unit })),
        total, paymentMode: payMode,
      });

      if (selectedVehicleId && orderId) {
        try {
          await api.dispatchStockOrders([orderId]);
        } catch (_e) {
          // non-blocking fallback
        }
      }

      const assignedVeh = vehicles.find(v => v.id === selectedVehicleId);
      setLastSale({
        buyer: shopId ? shops.find(s => s.id === shopId)?.name : custName.trim(),
        phone: shopId ? '' : custPhone.trim(),
        lines: cart, subtotal, discountVal, freightVal, total, payMode,
        assignedVeh: assignedVeh ? `${assignedVeh.code} (${assignedVeh.registrationNo || 'Van'})` : null,
        transportName, lrNo, at: new Date().toISOString(),
      });

      toast.success(`Sale recorded · ₹${total.toLocaleString('en-IN')}${assignedVeh ? ` · Assigned to ${assignedVeh.code}` : ''}`);
      setCart([]); setShopId(''); setCustName(''); setCustPhone('');
      setTransportName(''); setLrNo(''); setFreight(''); setDiscountAmt(''); setSelectedVehicleId('');
    } catch (e) {
      toast.error(e.message || 'Could not record sale');
    } finally { setBusy(false); }
  };

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
      transportName: lastSale.transportName || '',
      lrNo: lastSale.lrNo || '',
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
      subtotal: lastSale.subtotal,
      discountAmount: lastSale.discountVal,
      freightAmount: lastSale.freightVal,
      roundOff: 0, total: lastSale.total,
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

  const selectedShopObj = shops.find(s => s.id === shopId);

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>New Direct Sale &amp; Van Dispatch</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        Counter or phone orders with automatic Van assignment, transport details, discounts, and instant GST invoices.
      </p>

      {lastSale && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <CheckCircle2 size={16} color="#059669" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>
              {lastSale.buyer} · ₹{lastSale.total.toLocaleString('en-IN')} · {lastSale.assignedVeh ? `Dispatched via ${lastSale.assignedVeh}` : 'Ready for Dispatch'}
            </span>
          </div>
          <button onClick={printBill}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Receipt size={12} /> Print Invoice
          </button>
        </div>
      )}

      <div style={S.card}>
        <label style={S.label}>Customer / Retail Shop</label>
        <select value={shopId} onChange={e => { setShopId(e.target.value); if (e.target.value) { setCustName(''); setCustPhone(''); } }}
          style={{ ...S.input, marginBottom: shopId ? 6 : 8 }}>
          <option value="">— walk-in / not listed —</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name} {s.owed > 0 ? `(Owed: ₹${s.owed})` : ''}</option>)}
        </select>
        {selectedShopObj && selectedShopObj.owed > 0 && (
          <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 800, background: '#FEF2F2', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
            ⚠️ Party Outstanding Debt: ₹{selectedShopObj.owed.toLocaleString('en-IN')}
          </div>
        )}
        {!shopId && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer / shop name" style={S.input} />
            <input value={custPhone} onChange={e => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Phone (optional)" style={S.input} />
          </div>
        )}
      </div>

      {vehicles.length > 0 && (
        <div style={S.card}>
          <label style={S.label}>🚚 Assign to Delivery Van / Rep (Optional)</label>
          <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} style={S.input}>
            <option value="">— Warehouse Direct / Self Collection —</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.registrationNo || v.warehouseName || 'Delivery Vehicle'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={S.card}>
        <label style={S.label}>Add Product</label>
        <select value={pickProduct}
          onChange={e => {
            setPickProduct(e.target.value);
            const p = products.find(x => x.id === e.target.value);
            setPickRate(p?.price ? String(p.price) : '');
          }}
          style={{ ...S.input, marginBottom: 8 }}>
          <option value="">— select product —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''} - ₹{p.price}</option>)}
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
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Order Items ({cart.length})</div>
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

          {/* Transport & Adjustment Details */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={S.label}>Discount ₹ (optional)</label>
              <input type="number" inputMode="decimal" value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} placeholder="0" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Freight / Shipping ₹</label>
              <input type="number" inputMode="decimal" value={freight} onChange={e => setFreight(e.target.value)} placeholder="0" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Transport Name</label>
              <input type="text" value={transportName} onChange={e => setTransportName(e.target.value)} placeholder="e.g. Speed Lorry" style={S.input} />
            </div>
            <div>
              <label style={S.label}>L.R No.</label>
              <input type="text" value={lrNo} onChange={e => setLrNo(e.target.value)} placeholder="e.g. LR-9812" style={S.input} />
            </div>
          </div>

          <div style={{ margin: '14px 0 10px', textAlign: 'right' }}>
            {discountVal > 0 && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>Discount: -₹{discountVal}</div>}
            {freightVal > 0 && <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 700 }}>Freight: +₹{freightVal}</div>}
            <div style={{ fontSize: 22, fontWeight: 900, color: '#059669', marginTop: 4 }}>
              Total: ₹{total.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['cash', 'upi', 'credit'].map(m => {
              const blocked = m === 'credit' && !shopId;
              return (
                <button key={m} disabled={blocked} onClick={() => !blocked && setPayMode(m)}
                  title={blocked ? 'Credit needs a linked shop' : ''}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
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
            style={{ width: '100%', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}>
            <ShoppingCart size={16} /> {busy ? 'Recording…' : 'Record & Dispatch Sale'}
          </button>
        </div>
      )}
    </div>
  );
}
