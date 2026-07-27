// ═══════════════════════════════════════════════════════════════════
// PURCHASES — the inward half of a distributor's business
//
// A distributor BUYS from manufacturers and SELLS to shops. Only the
// sell half existed in this app: stock came into being by typing a
// number into "Add Product", which meant no supplier bills to
// reconcile, no view of what the business OWES, and no cost basis — so
// "profit" was never actually computable.
//
// Two tabs, because these are two different jobs a distributor does at
// two different times: entering a supplier's bill when goods arrive,
// and settling up with suppliers.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Plus, X, IndianRupee, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { purchaseApi } from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function Purchases() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const distId = distributorIdOf(user);

  const [tab, setTab] = useState('new');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [supplierId, setSupplierId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMode, setPayMode] = useState('credit');
  const [paidNow, setPaidNow] = useState('');
  const [lines, setLines] = useState([]);

  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickCost, setPickCost] = useState('');
  const [pickGst, setPickGst] = useState('0');

  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [showAddSup, setShowAddSup] = useState(false);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [sup, prods, bal, hist] = await Promise.all([
          purchaseApi.getSuppliers(distId),
          api.getDistributorProducts(distId),
          purchaseApi.getSupplierBalances(distId),
          purchaseApi.getPurchases(distId),
        ]);
        if (cancelled) return;
        setSuppliers(sup); setProducts(prods || []); setBalances(bal); setHistory(hist);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);
  const selected = products.find(p => p.id === pickProduct);

  const addSupplier = async () => {
    if (!newSupName.trim()) return toast.error('Enter the supplier name');
    setBusy(true);
    try {
      const id = await purchaseApi.addSupplier(distId, { name: newSupName, phone: newSupPhone });
      toast.success('Supplier added');
      setSupplierId(id); setNewSupName(''); setNewSupPhone(''); setShowAddSup(false);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const addLine = () => {
    if (!pickProduct) return toast.error('Pick a product');
    const qty = parseFloat(pickQty);
    const cost = parseFloat(pickCost);
    if (!qty || qty <= 0) return toast.error('Enter quantity');
    if (!cost || cost <= 0) return toast.error('Enter the cost rate');
    setLines(prev => [...prev, {
      productId: pickProduct, productName: selected.name,
      qty, costRate: cost, gstPct: parseFloat(pickGst) || 0,
    }]);
    setPickQty(''); setPickCost('');
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.costRate, 0);
  const gstTotal = lines.reduce((s, l) => s + (l.qty * l.costRate * (l.gstPct || 0) / 100), 0);
  const grandTotal = subtotal + gstTotal;

  const save = async () => {
    if (!supplierId) return toast.error('Select the supplier');
    if (lines.length === 0) return toast.error('Add at least one item');
    setBusy(true);
    try {
      await purchaseApi.recordPurchase(distId, {
        supplierId, billNo, billDate, lines,
        paymentMode: payMode, amountPaid: parseFloat(paidNow) || 0,
      });
      toast.success(`Purchase recorded · stock updated · ₹${Math.round(grandTotal).toLocaleString('en-IN')}`);
      setLines([]); setBillNo(''); setPaidNow('');
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const settle = async (b) => {
    const amt = parseFloat(window.prompt(`Payment to ${b.name}?\nOutstanding: ₹${Math.round(b.outstanding).toLocaleString('en-IN')}`, ''));
    if (!amt || amt <= 0) return;
    setBusy(true);
    try {
      await purchaseApi.paySupplier(distId, { supplierId: b.supplierId, amount: amt });
      toast.success(`₹${amt.toLocaleString('en-IN')} paid to ${b.name}`);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const totalPayable = balances.reduce((s, b) => s + Math.max(b.outstanding, 0), 0);

  const S = {
    card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18, marginBottom: 14 },
    input: { width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 14, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 780, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>Purchases</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
        Record what you buy from manufacturers. Stock goes up, cost is captured, and you can see what you owe.
      </p>

      {totalPayable > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '13px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#9A3412', fontWeight: 700, textTransform: 'uppercase' }}>You owe suppliers</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#C2410C' }}>₹{Math.round(totalPayable).toLocaleString('en-IN')}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['new', 'New Purchase'], ['owed', `Payables (${balances.filter(b => b.outstanding > 0).length})`], ['history', 'History']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '9px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${tab === k ? '#4F46E5' : '#E2E8F0'}`,
              background: tab === k ? '#EEF2FF' : '#fff', color: tab === k ? '#4338CA' : '#64748B' }}>{l}</button>
        ))}
      </div>

      {tab === 'new' && (
        <>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={S.label}>Supplier</label>
              <button onClick={() => setShowAddSup(v => !v)}
                style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {showAddSup ? 'Cancel' : '+ New supplier'}
              </button>
            </div>
            {showAddSup ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newSupName} onChange={e => setNewSupName(e.target.value)} placeholder="Manufacturer name" style={S.input} />
                <input value={newSupPhone} onChange={e => setNewSupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Phone" style={S.input} />
                <button onClick={addSupplier} disabled={busy}
                  style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 16px', borderRadius: 9, cursor: 'pointer', flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={S.input}>
                <option value="">— select —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Their bill no.</label>
                <input value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. SBF/2026/881" style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Bill date</label>
                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={S.input} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
              Use the supplier&apos;s own bill number — it&apos;s what you&apos;ll match against the paper copy.
            </p>
          </div>

          <div style={S.card}>
            <label style={S.label}>Item</label>
            <select value={pickProduct}
              onChange={e => {
                setPickProduct(e.target.value);
                const p = products.find(x => x.id === e.target.value);
                // Seed from last known cost and the product's GST rate —
                // most repeat purchases are at the same terms.
                setPickCost(p?.costPrice ? String(p.costPrice) : '');
                setPickGst(p?.gstRate != null ? String(p.gstRate) : '0');
              }}
              style={{ ...S.input, marginBottom: 8 }}>
              <option value="">— select —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={pickQty} onChange={e => setPickQty(e.target.value)} placeholder="Qty" style={S.input} />
              <input type="number" value={pickCost} onChange={e => setPickCost(e.target.value)} placeholder="Cost ₹" style={S.input} />
              <select value={pickGst} onChange={e => setPickGst(e.target.value)} style={{ ...S.input, width: 90 }}>
                {['0', '5', '12', '18', '28'].map(g => <option key={g} value={g}>{g}%</option>)}
              </select>
              <button onClick={addLine} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 15px', borderRadius: 9, cursor: 'pointer', flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </div>
            {selected?.price > 0 && pickCost > 0 && (
              <p style={{ fontSize: 11, color: parseFloat(pickCost) < selected.price ? '#059669' : '#DC2626', margin: '6px 0 0', fontWeight: 600 }}>
                Selling at ₹{selected.price} → margin {Math.round(((selected.price - parseFloat(pickCost)) / selected.price) * 100)}%
              </p>
            )}
          </div>

          {lines.length > 0 && (
            <div style={S.card}>
              {lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.productName}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {l.qty} × ₹{l.costRate} {l.gstPct > 0 && `+ ${l.gstPct}% GST`} = ₹{Math.round(l.qty * l.costRate * (1 + l.gstPct / 100)).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <button onClick={() => setLines(ls => ls.filter((_, x) => x !== i))}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 12, color: '#64748B', textAlign: 'right' }}>
                Subtotal ₹{Math.round(subtotal).toLocaleString('en-IN')} · GST ₹{Math.round(gstTotal).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', textAlign: 'right', margin: '4px 0 12px' }}>
                ₹{Math.round(grandTotal).toLocaleString('en-IN')}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Payment</label>
                  <select value={payMode} onChange={e => setPayMode(e.target.value)} style={S.input}>
                    <option value="credit">On credit</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Paid now ₹</label>
                  <input type="number" value={paidNow} onChange={e => setPaidNow(e.target.value)} placeholder="0" style={S.input} />
                </div>
              </div>

              <button onClick={save} disabled={busy}
                style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                {busy ? 'Saving…' : 'Record Purchase & Add Stock'}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'owed' && (
        balances.filter(b => b.outstanding > 0).length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', color: '#94A3B8', padding: 36 }}>
            <IndianRupee size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nothing outstanding with suppliers.</p>
          </div>
        ) : balances.filter(b => b.outstanding > 0).map(b => (
          <div key={b.supplierId} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{b.name}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Bought ₹{Math.round(b.purchased).toLocaleString('en-IN')} · Paid ₹{Math.round(b.paid).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#C2410C' }}>
                ₹{Math.round(b.outstanding).toLocaleString('en-IN')}
              </div>
              <button onClick={() => settle(b)} disabled={busy}
                style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Pay
              </button>
            </div>
          </div>
        ))
      )}

      {tab === 'history' && (
        history.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', color: '#94A3B8', padding: 36 }}>
            <FileText size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No purchases recorded yet.</p>
          </div>
        ) : history.map(h => (
          <div key={h.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{h.supplierName}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {h.billNo} · {new Date(h.billDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>₹{Math.round(h.total).toLocaleString('en-IN')}</div>
                {h.total - h.amountPaid > 0 && (
                  <div style={{ fontSize: 11, color: '#C2410C', fontWeight: 700 }}>
                    ₹{Math.round(h.total - h.amountPaid).toLocaleString('en-IN')} due
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#475569' }}>
              {h.lines.map((l, i) => <span key={i}>{i > 0 && ' · '}{l.name} ×{l.qty}</span>)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
