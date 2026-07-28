// ═══════════════════════════════════════════════════════════════════
// ENTERPRISE SUPPLIER PURCHASES & INWARD PAYABLES TERMINAL
// Record Inward Supplier Bills, Increase Warehouse Stock,
// Track GST Input Tax Credit (ITC), Compute Product Margins,
// and Manage Manufacturer Payables Ledgers.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { 
  ArrowLeft, Plus, X, IndianRupee, FileText, Building2, 
  Search, CheckCircle2, TrendingUp, AlertTriangle, Wallet, DollarSign
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { purchaseApi } from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function Purchases() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const distId = distributorIdOf(user);

  const [tab, setTab] = useState('new'); // 'new' | 'owed' | 'history'
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMode, setPayMode] = useState('credit');
  const [paidNowInput, setPaidNowInput] = useState('');
  const [freightInput, setFreightInput] = useState('0');
  const [notesInput, setNotesInput] = useState('');
  const [lines, setLines] = useState([]);

  // Line item addition state
  const [pickProduct, setPickProduct] = useState('');
  const [pickBoxes, setPickBoxes] = useState('');
  const [pickLooseUnits, setPickLooseUnits] = useState('');
  const [pickCost, setPickCost] = useState('');
  const [pickGst, setPickGst] = useState('0');

  // Supplier Creation Modal
  const [showAddSup, setShowAddSup] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupGstin, setNewSupGstin] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

  // Supplier Settlement Modal State
  const [payModalSupplier, setPayModalSupplier] = useState(null);
  const [payModalAmount, setPayModalAmount] = useState('');
  const [payModalMode, setPayModalMode] = useState('cash');
  const [payModalNote, setPayModalNote] = useState('');

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
        setSuppliers(sup || []);
        setProducts(prods || []);
        setBalances(bal || []);
        setHistory(hist || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load purchases data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);
  const selectedProduct = useMemo(() => products.find(p => p.id === pickProduct), [products, pickProduct]);
  const selectedSupplierObj = useMemo(() => suppliers.find(s => s.id === supplierId), [suppliers, supplierId]);

  const addSupplier = async () => {
    if (!newSupName.trim()) return toast.error('Please enter manufacturer / supplier name');
    setBusy(true);
    try {
      const id = await purchaseApi.addSupplier(distId, {
        name: newSupName.trim(),
        phone: newSupPhone.trim(),
        gstin: newSupGstin.trim(),
        address: newSupAddress.trim(),
      });
      toast.success('Supplier added successfully');
      setSupplierId(id);
      setNewSupName('');
      setNewSupPhone('');
      setNewSupGstin('');
      setNewSupAddress('');
      setShowAddSup(false);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not add supplier');
    } finally {
      setBusy(false);
    }
  };

  const addLineItem = () => {
    if (!selectedProduct) return toast.error('Select a product to inward');

    const packSize = selectedProduct.packSize || 1;
    const boxes = parseFloat(pickBoxes) || 0;
    const loose = parseFloat(pickLooseUnits) || 0;
    const totalQty = (boxes * packSize) + loose;

    if (totalQty <= 0) return toast.error('Enter valid boxes or loose quantity');

    const costRate = parseFloat(pickCost);
    if (isNaN(costRate) || costRate <= 0) return toast.error('Enter valid cost price');

    const gstPct = parseFloat(pickGst) || 0;
    const lineSubtotal = totalQty * costRate;
    const lineGst = lineSubtotal * (gstPct / 100);
    const lineTotal = lineSubtotal + lineGst;

    setLines(prev => [...prev, {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku || '',
      packSize,
      boxes,
      looseUnits: loose,
      qty: totalQty,
      costRate,
      gstPct,
      lineSubtotal,
      lineGst,
      lineTotal,
    }]);

    setPickProduct('');
    setPickBoxes('');
    setPickLooseUnits('');
    setPickCost('');
    setPickGst('0');
  };

  const removeLineItem = (idx) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    const rawSubtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const gstTotal = lines.reduce((s, l) => s + l.lineGst, 0);
    const freight = parseFloat(freightInput) || 0;
    const grandTotal = rawSubtotal + gstTotal + freight;
    return {
      rawSubtotal,
      gstTotal,
      freight,
      grandTotal: Math.round(grandTotal),
    };
  }, [lines, freightInput]);

  const handleSavePurchase = async () => {
    if (!supplierId) return toast.error('Please select the manufacturer / supplier');
    if (lines.length === 0) return toast.error('Please add at least one product item');

    setBusy(true);
    try {
      const amountPaid = payMode === 'credit' ? (parseFloat(paidNowInput) || 0) : totals.grandTotal;
      await purchaseApi.recordPurchase(distId, {
        supplierId,
        billNo,
        billDate,
        lines: lines.map(l => ({
          product_id: l.productId,
          product_name: l.productName,
          qty: l.qty,
          cost_rate: l.costRate,
          gst_pct: l.gstPct,
        })),
        paymentMode: payMode,
        amountPaid,
        notes: notesInput,
      });

      toast.success(`Purchase Bill recorded · Stock Updated · ₹${totals.grandTotal.toLocaleString('en-IN')}`);
      setLines([]);
      setBillNo('');
      setPaidNowInput('');
      setFreightInput('0');
      setNotesInput('');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not record purchase');
    } finally {
      setBusy(false);
    }
  };

  const handlePaySupplierSubmit = async () => {
    if (!payModalSupplier) return;
    const amt = parseFloat(payModalAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid payment amount');

    setBusy(true);
    try {
      await purchaseApi.paySupplier(distId, {
        supplierId: payModalSupplier.supplierId,
        amount: amt,
        mode: payModalMode,
        note: payModalNote,
      });
      toast.success(`₹${amt.toLocaleString('en-IN')} paid to ${payModalSupplier.name}`);
      setPayModalSupplier(null);
      setPayModalAmount('');
      setPayModalNote('');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not record supplier payment');
    } finally {
      setBusy(false);
    }
  };

  const totalPayableDebt = useMemo(() => balances.reduce((s, b) => s + Math.max(b.outstanding, 0), 0), [balances]);

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 18, boxShadow: '0 4px 12px rgba(15,23,42,0.03)' },
    input: { width: '100%', padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', color: '#0F172A' },
    label: { display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' },
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#64748B', fontSize: '16px', fontWeight: 'bold' }}>Loading Supplier Payables &amp; Inward Purchasing…</div>;
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#0F172A' }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#4F46E5', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', margin: 0 }}>Inward Stock &amp; Supplier Payables</h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          Record manufacturer bills, increase warehouse stock, capture cost basis, and track payables.
        </p>
      </div>

      {/* Supplier Payables Total Alert Banner */}
      {totalPayableDebt > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FDBA74', borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: '0 4px 14px rgba(234,88,12,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9A3412', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Owed to Manufacturers / Suppliers</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#C2410C', marginTop: 2 }}>₹{Math.round(totalPayableDebt).toLocaleString('en-IN')}</div>
            </div>
            <button onClick={() => setTab('owed')} style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,88,12,0.3)' }}>
              View Payables List
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          ['new', '📥 Record Inward Bill'],
          ['owed', ` Manufacturer Payables (${balances.filter(b => b.outstanding > 0).length})`],
          ['history', '📋 Purchase History'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer',
              border: `2px solid ${tab === k ? '#4F46E5' : '#E2E8F0'}`,
              background: tab === k ? '#EEF2FF' : '#FFFFFF',
              color: tab === k ? '#4338CA' : '#64748B',
              boxShadow: tab === k ? '0 4px 12px rgba(79,70,229,0.15)' : 'none',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* TAB 1: RECORD NEW INWARD PURCHASE BILL */}
      {tab === 'new' && (
        <>
          {/* Supplier Header Information */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={S.label}>Manufacturer / Supplier</label>
              <button onClick={() => setShowAddSup(!showAddSup)}
                style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {showAddSup ? 'Cancel' : '+ Create New Supplier Account'}
              </button>
            </div>

            {/* Quick Supplier Creation Card */}
            {showAddSup ? (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Create Supplier Account</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Supplier / Company Name</label>
                    <input value={newSupName} onChange={e => setNewSupName(e.target.value)} placeholder="e.g. Parle Agro Ltd" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Phone Number</label>
                    <input value={newSupPhone} onChange={e => setNewSupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit phone" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>GSTIN (Optional)</label>
                    <input value={newSupGstin} onChange={e => setNewSupGstin(e.target.value.toUpperCase())} placeholder="e.g. 37AAAAA0000A1Z5" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>City / Address</label>
                    <input value={newSupAddress} onChange={e => setNewSupAddress(e.target.value)} placeholder="e.g. Sompeta Warehouse" style={S.input} />
                  </div>
                </div>
                <button onClick={addSupplier} disabled={busy}
                  style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  Save &amp; Select Supplier
                </button>
              </div>
            ) : (
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={S.input}>
                <option value="">— Select Manufacturer / Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
              </select>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div>
                <label style={S.label}>Supplier Bill No.</label>
                <input value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. SBF/2026/881" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Bill Date</label>
                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={S.input} />
              </div>
            </div>
          </div>

          {/* Product Line Entry Form */}
          <div style={S.card}>
            <label style={S.label}>Add Inward Item &amp; Cost Basis</label>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Product</label>
                <select value={pickProduct}
                  onChange={e => {
                    setPickProduct(e.target.value);
                    const p = products.find(x => x.id === e.target.value);
                    setPickCost(p?.costPrice ? String(p.costPrice) : (p?.price ? String((p.price * 0.8).toFixed(2)) : ''));
                    setPickGst(p?.gstRate != null ? String(p.gstRate) : '0');
                  }}
                  style={S.input}>
                  <option value="">— Select Product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Selling Price: ₹{p.price})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Boxes / Cases</label>
                <input type="number" inputMode="numeric" value={pickBoxes} onChange={e => setPickBoxes(e.target.value)} placeholder="0" style={S.input} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Loose Jars</label>
                <input type="number" inputMode="numeric" value={pickLooseUnits} onChange={e => setPickLooseUnits(e.target.value)} placeholder="0" style={S.input} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Cost Rate (₹)</label>
                <input type="number" inputMode="decimal" value={pickCost} onChange={e => setPickCost(e.target.value)} placeholder="Cost ₹" style={S.input} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>GST %</label>
                <select value={pickGst} onChange={e => setPickGst(e.target.value)} style={S.input}>
                  {['0', '3', '5', '12', '18', '28'].map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>

              <button onClick={addLineItem}
                style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                <Plus size={16} /> Add Item
              </button>
            </div>

            {/* Margin Predictor */}
            {selectedProduct && selectedProduct.price > 0 && parseFloat(pickCost) > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: parseFloat(pickCost) < selectedProduct.price ? '#059669' : '#DC2626', fontWeight: 800, background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                📊 Selling Price: ₹{selectedProduct.price} → Cost: ₹{pickCost} · Profit Margin: {Math.round(((selectedProduct.price - parseFloat(pickCost)) / selectedProduct.price) * 100)}%
              </div>
            )}
          </div>

          {/* Inward Items Table & Settlement */}
          {lines.length > 0 && (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 900, color: '#0F172A' }}>
                Inward Bill Items ({lines.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '10px 8px', fontWeight: 800 }}>#</th>
                      <th style={{ padding: '10px 8px', fontWeight: 800 }}>Product Name</th>
                      <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Total Qty Received</th>
                      <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Cost Price (₹)</th>
                      <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>GST %</th>
                      <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Line Total (₹)</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 8px', color: '#64748B', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 800, color: '#0F172A' }}>{item.productName}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800 }}>{item.qty} units</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>₹{item.costRate}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#475569' }}>{item.gstPct}%</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, color: '#0F172A' }}>₹{item.lineTotal.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button onClick={() => removeLineItem(idx)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid #F1F5F9', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, color: '#64748B' }}>
                  Subtotal: <strong>₹{totals.rawSubtotal.toFixed(2)}</strong> · GST Input Credit: <strong>₹{totals.gstTotal.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A' }}>
                  Grand Total: ₹{totals.grandTotal.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <div>
                  <label style={S.label}>Payment Settlement Terms</label>
                  <select value={payMode} onChange={e => setPayMode(e.target.value)} style={S.input}>
                    <option value="credit">On Credit (Add to Supplier Payables Ledger)</option>
                    <option value="cash">Full Cash Payment</option>
                    <option value="upi">Full UPI Payment</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque Payment</option>
                  </select>
                </div>

                {payMode === 'credit' && (
                  <div>
                    <label style={S.label}>Part Payment Paid Now ₹ (Optional)</label>
                    <input type="number" inputMode="decimal" value={paidNowInput} onChange={e => setPaidNowInput(e.target.value)} placeholder="0" style={S.input} />
                  </div>
                )}
              </div>

              <button onClick={handleSavePurchase} disabled={busy}
                style={{ width: '100%', marginTop: 20, background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 20px rgba(5,150,105,0.3)' }}>
                {busy ? 'Recording Purchase…' : 'Record Purchase & Increment Stock'}
              </button>
            </div>
          )}
        </>
      )}

      {/* TAB 2: MANUFACTURER PAYABLES DIRECTORY & SETTLEMENT */}
      {tab === 'owed' && (
        <div style={S.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
            Manufacturer Payables Directory
          </h3>

          {balances.filter(b => b.outstanding > 0).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>
              <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>No Outstanding Payables!</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>All manufacturer bills are fully settled.</p>
            </div>
          ) : (
            balances.filter(b => b.outstanding > 0).map(b => (
              <div key={b.supplierId} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '5px solid #EA580C', borderRadius: 14, padding: 18, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0F172A' }}>{b.name}</h4>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    Total Purchases: ₹{Math.round(b.purchased).toLocaleString('en-IN')} · Total Paid: ₹{Math.round(b.paid).toLocaleString('en-IN')}
                  </div>
                  {b.lastBillDate && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Last Bill: {new Date(b.lastBillDate).toLocaleDateString()}</div>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#C2410C' }}>
                    ₹{Math.round(b.outstanding).toLocaleString('en-IN')}
                  </div>
                  <button onClick={() => { setPayModalSupplier(b); setPayModalAmount(String(Math.round(b.outstanding))); }}
                    style={{ marginTop: 6, background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                    💸 Pay Supplier
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: PURCHASE HISTORY */}
      {tab === 'history' && (
        <div style={S.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
            Inward Purchase History
          </h3>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>
              <FileText size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 14 }}>No inward purchases recorded yet.</p>
            </div>
          ) : (
            history.map(h => (
              <div key={h.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{h.supplierName}</h4>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748B' }}>
                      Bill No: <strong>{h.billNo}</strong> · Date: {new Date(h.billDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>₹{Math.round(h.total).toLocaleString('en-IN')}</div>
                    {h.total - h.amountPaid > 0 && (
                      <span style={{ fontSize: 10, background: '#FFEDD5', color: '#C2410C', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>
                        Due: ₹{Math.round(h.total - h.amountPaid).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#475569' }}>
                  {h.lines.map((l, i) => <span key={i}>{i > 0 && ' · '}{l.name} ×{l.qty}</span>)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Supplier Payment Settlement Modal */}
      {payModalSupplier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F172A' }}>Settle Supplier Payment</h3>
              <button onClick={() => setPayModalSupplier(null)} style={{ background: '#F1F5F9', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#9A3412' }}>{payModalSupplier.name}</div>
              <div style={{ fontSize: 12, color: '#C2410C', marginTop: 2 }}>
                Current Outstanding Debt: <strong>₹{Math.round(payModalSupplier.outstanding).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Payment Amount ₹</label>
              <input type="number" inputMode="decimal" value={payModalAmount} onChange={e => setPayModalAmount(e.target.value)} style={S.input} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Payment Mode</label>
              <select value={payModalMode} onChange={e => setPayModalMode(e.target.value)} style={S.input}>
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI</option>
                <option value="bank">🏦 Bank Transfer</option>
                <option value="cheque">📜 Cheque</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Note / Reference No. (Optional)</label>
              <input value={payModalNote} onChange={e => setPayModalNote(e.target.value)} placeholder="e.g. UTR / Cheque #8912" style={S.input} />
            </div>

            <button onClick={handlePaySupplierSubmit} disabled={busy}
              style={{ width: '100%', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
              {busy ? 'Recording Payment…' : 'Record Supplier Payment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
