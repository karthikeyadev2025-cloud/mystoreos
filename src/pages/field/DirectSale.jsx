// ═══════════════════════════════════════════════════════════════════
// ENTERPRISE FMCG DIRECT SALE & INVOICING TERMINAL
// Real B2B Wholesale Invoicing with Pack Size Math (Boxes/Jars),
// GST Tax Calculations, Quotation Mode, Delivery Van Assignment,
// WhatsApp Sharing, and Credit Ledger Settlement.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { 
  ArrowLeft, Plus, X, Receipt, CheckCircle2, ShoppingCart, 
  Search, Truck, FileText, Share2, Tag, Percent, DollarSign, 
  AlertTriangle, Calculator, ShieldCheck, Printer
} from 'lucide-react';
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
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Document Config
  const [docType, setDocType] = useState('invoice'); // 'invoice' | 'quotation' | 'challan'
  const [isInterstate, setIsInterstate] = useState(false);

  // Customer State
  const [shopId, setShopId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGstin, setCustGstin] = useState('');

  // Cart & Line Items
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Product Line Entry Form State
  const [selectedProdId, setSelectedProdId] = useState('');
  const [entryBoxes, setEntryBoxes] = useState('');
  const [entryLooseUnits, setEntryLooseUnits] = useState('');
  const [entryRate, setEntryRate] = useState('');
  const [entryDiscPct, setEntryDiscPct] = useState('0');

  // Order Adjustments & Logistics
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [transportName, setTransportName] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [freightCharges, setFreightCharges] = useState('0');
  const [orderDiscount, setOrderDiscount] = useState('0');
  const [orderNotes, setOrderNotes] = useState('');

  // Payment Settlement
  const [payMode, setPayMode] = useState('cash');
  const [amountPaidInput, setAmountPaidInput] = useState('');

  // Last Saved Sale State
  const [lastSale, setLastSale] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        if (!cancelled) toast.error(e.message || 'Could not load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProdId), [products, selectedProdId]);

  // Dynamic search filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q) || 
      p.hsnCode?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handleProductSelect = (prodId) => {
    setSelectedProdId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setEntryRate(prod.price ? String(prod.price) : '');
      setEntryBoxes('');
      setEntryLooseUnits('');
      setEntryDiscPct('0');
    }
  };

  const addLineItem = () => {
    if (!selectedProduct) return toast.error('Please select a product');

    const packSize = selectedProduct.packSize || 1;
    const boxes = parseFloat(entryBoxes) || 0;
    const loose = parseFloat(entryLooseUnits) || 0;
    const totalQty = (boxes * packSize) + loose;

    if (totalQty <= 0) return toast.error('Enter valid boxes or loose quantity');

    const rate = parseFloat(entryRate);
    if (isNaN(rate) || rate <= 0) return toast.error('Enter a valid selling rate');

    const lineDiscPct = parseFloat(entryDiscPct) || 0;
    const rawTotal = totalQty * rate;
    const discAmount = rawTotal * (lineDiscPct / 100);
    const taxableAmount = rawTotal - discAmount;
    const gstRate = parseFloat(selectedProduct.gstRate || 0);
    const gstAmount = taxableAmount * (gstRate / 100);
    const netLineTotal = taxableAmount + gstAmount;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.productId === selectedProduct.id);
      const newItem = {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku || '',
        hsn: selectedProduct.hsnCode || '',
        unit: selectedProduct.unit || 'Pcs',
        packSize,
        boxes,
        looseUnits: loose,
        qty: totalQty,
        rate,
        discPct: lineDiscPct,
        discAmount,
        taxableAmount,
        gstRate,
        gstAmount,
        lineTotal: netLineTotal,
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = newItem;
        return copy;
      }
      return [...prev, newItem];
    });

    // Reset line form
    setSelectedProdId('');
    setEntryBoxes('');
    setEntryLooseUnits('');
    setEntryRate('');
    setEntryDiscPct('0');
  };

  const removeLineItem = (productId) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateLineQty = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newQty = Math.max(1, item.qty + delta);
      const packSize = item.packSize || 1;
      const boxes = Math.floor(newQty / packSize);
      const looseUnits = newQty % packSize;
      const rawTotal = newQty * item.rate;
      const discAmount = rawTotal * (item.discPct / 100);
      const taxableAmount = rawTotal - discAmount;
      const gstAmount = taxableAmount * (item.gstRate / 100);
      return {
        ...item,
        qty: newQty,
        boxes,
        looseUnits,
        discAmount,
        taxableAmount,
        gstAmount,
        lineTotal: taxableAmount + gstAmount,
      };
    }));
  };

  // Calculations
  const totals = useMemo(() => {
    const rawSubtotal = cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
    const totalLineDiscount = cart.reduce((sum, item) => sum + item.discAmount, 0);
    const taxableSubtotal = cart.reduce((sum, item) => sum + item.taxableAmount, 0);
    const totalGst = cart.reduce((sum, item) => sum + item.gstAmount, 0);
    
    const cgst = isInterstate ? 0 : (totalGst / 2);
    const sgst = isInterstate ? 0 : (totalGst / 2);
    const igst = isInterstate ? totalGst : 0;

    const flatDiscount = parseFloat(orderDiscount) || 0;
    const freight = parseFloat(freightCharges) || 0;

    const grossTotal = taxableSubtotal + totalGst - flatDiscount + freight;
    const roundedGrandTotal = Math.round(grossTotal);
    const roundOff = (roundedGrandTotal - grossTotal).toFixed(2);

    return {
      rawSubtotal,
      totalLineDiscount,
      taxableSubtotal,
      totalGst,
      cgst,
      sgst,
      igst,
      flatDiscount,
      freight,
      grandTotal: Math.max(0, roundedGrandTotal),
      roundOff,
    };
  }, [cart, orderDiscount, freightCharges, isInterstate]);

  const selectedShopObj = useMemo(() => shops.find(s => s.id === shopId), [shops, shopId]);

  const handleSubmitSale = async () => {
    if (!shopId && !custName.trim()) {
      return toast.error('Please select a retail shop or enter customer name');
    }
    if (!shopId && payMode === 'credit') {
      return toast.error('Credit sales require a linked retail shop');
    }
    if (cart.length === 0) {
      return toast.error('Please add at least one product to the invoice');
    }

    setBusy(true);
    try {
      const finalAmountPaid = payMode === 'credit' 
        ? (parseFloat(amountPaidInput) || 0)
        : totals.grandTotal;

      const orderId = await api.createDirectSale(distId, {
        shopId: shopId || null,
        customerName: shopId ? '' : custName.trim(),
        customerPhone: shopId ? '' : custPhone.trim(),
        items: cart.map(l => ({
          id: l.productId,
          name: l.name,
          price: l.rate,
          qty: l.qty,
          unit: l.unit,
          gstPct: l.gstRate,
          hsn: l.hsn,
          sku: l.sku,
          packSize: l.packSize,
        })),
        total: totals.grandTotal,
        paymentMode: payMode,
      });

      // Auto-dispatch to selected Delivery Van if picked
      if (selectedVehicleId && orderId) {
        try {
          await api.dispatchStockOrders([orderId]);
        } catch (_err) {
          // non-blocking
        }
      }

      const assignedVeh = vehicles.find(v => v.id === selectedVehicleId);
      const saleRecord = {
        orderId,
        docType,
        buyer: shopId ? selectedShopObj?.name : custName.trim(),
        phone: shopId ? selectedShopObj?.phone || '' : custPhone.trim(),
        gstin: shopId ? selectedShopObj?.gstin || '' : custGstin.trim(),
        lines: cart,
        totals,
        payMode,
        amountPaid: finalAmountPaid,
        balanceDue: totals.grandTotal - finalAmountPaid,
        assignedVeh: assignedVeh ? `${assignedVeh.code} (${assignedVeh.registrationNo || 'Delivery Van'})` : null,
        transportName,
        lrNo,
        lrDate,
        notes: orderNotes,
        at: new Date().toISOString(),
      };

      setLastSale(saleRecord);
      toast.success(`${docType === 'quotation' ? 'Quotation' : 'Sale Invoice'} recorded successfully! · ₹${totals.grandTotal.toLocaleString('en-IN')}`);

      // Clear Form for next sale
      setCart([]);
      setShopId('');
      setCustName('');
      setCustPhone('');
      setCustGstin('');
      setTransportName('');
      setLrNo('');
      setLrDate('');
      setFreightCharges('0');
      setOrderDiscount('0');
      setOrderNotes('');
      setSelectedVehicleId('');
      setAmountPaidInput('');
    } catch (e) {
      toast.error(e.message || 'Could not record sale');
    } finally {
      setBusy(false);
    }
  };

  const handlePrintInvoice = (format = 'a4', isDuplicate = false) => {
    if (!lastSale) return;
    const hasGstin = !!(user?.gstin && String(user.gstin).trim());
    
    let templateId = 'wholesale';
    if (lastSale.docType === 'quotation') templateId = 'minimal';
    else if (hasGstin) templateId = 'gst_tax';

    printInvoice(templateId, {
      shopName: user?.name || 'Distributor Warehouse',
      shopPhone: user?.phone || '',
      shopAddress: user?.businessAddress || '',
      shopGSTIN: user?.gstin || '',
      logoUrl: user?.logo || '',
      billNo: `INV-${Date.now().toString().slice(-6)}`,
      dateStr: new Date(lastSale.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      modeTitle: lastSale.docType === 'quotation' ? 'Quotation / Proforma' : (hasGstin ? 'Tax Invoice' : 'Wholesale Supply Bill'),
      customerName: lastSale.buyer || 'Customer',
      customerPhone: lastSale.phone || '',
      customerGSTIN: lastSale.gstin || '',
      transportName: lastSale.transportName || '',
      lrNo: lastSale.lrNo || '',
      items: lastSale.lines.map(l => ({
        code: l.sku || '',
        name: l.name,
        hsn: l.hsn || '',
        jars: l.packSize || 1,
        boxes: l.boxes > 0 ? l.boxes : null,
        qty: l.qty,
        unit: l.unit ? (UNIT_SUFFIX[l.unit] || l.unit) : '',
        rate: l.rate,
        gstPct: l.gstRate || 0,
      })),
      subtotal: lastSale.totals.taxableSubtotal,
      discountAmount: lastSale.totals.flatDiscount + lastSale.totals.totalLineDiscount,
      freightAmount: lastSale.totals.freight,
      roundOff: lastSale.totals.roundOff,
      total: lastSale.totals.grandTotal,
      paymentMode: lastSale.payMode,
      footerNote: 'Thank you for doing business with us.',
      termsNote: 'Damage/Breakage recovery governed by standard FMCG trade terms. Subject to local jurisdiction.',
    }, format, { isDuplicate });
  };

  const handleShareWhatsApp = () => {
    if (!lastSale) return;
    const phoneStr = lastSale.phone.replace(/\D/g, '');
    const upiUri = user?.upiId ? `upi://pay?pa=${encodeURIComponent(user.upiId)}&pn=${encodeURIComponent(user.name || 'Distributor')}&am=${lastSale.totals.grandTotal}&cu=INR` : '';
    
    let text = `📦 *${user?.name || 'Distributor'} — Wholesale Invoice*\n\n` +
      `Bill To: *${lastSale.buyer}*\n` +
      `Amount Due: *₹${lastSale.totals.grandTotal.toLocaleString('en-IN')}*\n` +
      `Payment Mode: ${lastSale.payMode.toUpperCase()}\n\n` +
      `*Items Summary:*\n` +
      lastSale.lines.map(l => `• ${l.name} (${l.qty} ${l.unit}) @ ₹${l.rate} = ₹${l.lineTotal.toFixed(0)}`).join('\n');

    if (upiUri) {
      text += `\n\n💳 *Pay via UPI Direct Link:*\n${upiUri}`;
    }
    
    text += `\n\nThank you for your business!`;
    window.open(`https://wa.me/${phoneStr.length === 10 ? '91' + phoneStr : phoneStr}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#64748B', fontSize: '16px', fontWeight: 'bold' }}>Loading Wholesale Inventory &amp; Linked Shops…</div>;
  }

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 18, boxShadow: '0 4px 12px rgba(15,23,42,0.03)' },
    input: { width: '100%', padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', color: '#0F172A' },
    label: { display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' },
    badgePill: { padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 },
  };

  return (
    <div style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#0F172A' }}>
      <ToastContainer theme="light" position="top-center" />

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/distributor')}
          style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#4F46E5', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => setIsInterstate(!isInterstate)}
            style={{ ...S.badgePill, background: isInterstate ? '#FEF3C7' : '#F1F5F9', color: isInterstate ? '#92400E' : '#475569', border: '1px solid #CBD5E1', cursor: 'pointer' }}
          >
            {isInterstate ? '🌐 Interstate (IGST)' : '📍 Intrastate (CGST+SGST)'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', margin: 0 }}>Wholesale Billing &amp; Sales Terminal</h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          Create B2B GST Invoices, Quotations, and Van Dispatch Orders with FMCG pack-size breakdown.
        </p>
      </div>

      {/* Last Invoice Completion Banner */}
      {lastSale && (
        <div style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: '1px solid #A7F3D0', borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: '0 6px 20px rgba(16,185,129,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} color="#059669" />
                <span style={{ fontSize: 16, fontWeight: 900, color: '#047857' }}>
                  {lastSale.docType === 'quotation' ? 'Quotation Generated' : 'Invoice Completed'} · ₹{lastSale.totals.grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 28px', fontSize: 12, color: '#065F46' }}>
                Customer: <strong>{lastSale.buyer}</strong> · {lastSale.assignedVeh ? `Van: ${lastSale.assignedVeh}` : 'Warehouse Direct'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => handlePrintInvoice('a4', false)}
                style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={15} /> Print A4
              </button>
              <button onClick={() => handlePrintInvoice('a5', false)}
                style={{ background: '#7C3AED', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={15} /> Print A5
              </button>
              <button onClick={() => handlePrintInvoice('a4', true)}
                style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Printer size={15} /> Print Duplicate Copy
              </button>
              <button onClick={() => handlePrintInvoice('3inch', false)}
                style={{ background: '#0284C7', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Printer size={15} /> Thermal Receipt
              </button>
              {lastSale.phone && (
                <button onClick={handleShareWhatsApp}
                  style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Share2 size={15} /> WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Document Type & Customer Selection */}
      <div style={S.card}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Invoice Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} style={S.input}>
              <option value="invoice">📄 Tax Invoice (GST Bill)</option>
              <option value="quotation">📑 Quotation / Estimate</option>
              <option value="challan">🚚 Delivery Challan</option>
            </select>
          </div>

          <div>
            <label style={S.label}>Retail Shop / Party Account</label>
            <select value={shopId} onChange={e => { setShopId(e.target.value); if (e.target.value) { setCustName(''); setCustPhone(''); } }}
              style={S.input}>
              <option value="">— Walk-in Customer / Cash Counter Sale —</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.owed > 0 ? `(Owed: ₹${s.owed.toLocaleString('en-IN')})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Party Debt & Credit Limit Alert */}
        {selectedShopObj && (
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>PARTY CREDIT LEDGER STATUS</span>
              <div style={{ fontSize: 14, fontWeight: 900, color: selectedShopObj.owed > 0 ? '#DC2626' : '#059669', marginTop: 2 }}>
                {selectedShopObj.owed > 0 ? `Outstanding Debt: ₹${selectedShopObj.owed.toLocaleString('en-IN')}` : 'Clean Balance (No Debt Owed)'}
              </div>
            </div>
            {selectedShopObj.phone && (
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>📞 {selectedShopObj.phone}</span>
            )}
          </div>
        )}

        {/* Walk-in Customer Details */}
        {!shopId && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>Customer Name</label>
              <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="e.g. Venkatesh Stores" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Phone Number</label>
              <input value={custPhone} onChange={e => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit phone" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Customer GSTIN (Optional)</label>
              <input value={custGstin} onChange={e => setCustGstin(e.target.value.toUpperCase())} placeholder="e.g. 37ABCDE1234F1Z5" style={S.input} />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Product Addition & FMCG Pack Size Billing Form */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <label style={{ ...S.label, margin: 0 }}>Add Product Items</label>
          {products.length > 0 && (
            <div style={{ position: 'relative', width: isMobile ? '100%' : 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#94A3B8' }} />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Search catalog by name or SKU…" 
                style={{ ...S.input, paddingLeft: 30, padding: '7px 10px 7px 30px', fontSize: 12 }} 
              />
            </div>
          )}
        </div>

        {isMobile ? (
          /* Mobile Stacked Input Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Select Product</label>
              <select value={selectedProdId} onChange={e => handleProductSelect(e.target.value)} style={S.input}>
                <option value="">— Select Wholesale Product —</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `[${p.sku}]` : ''} · ₹{p.price}/{p.unit || 'unit'} (Stock: {p.stock || 0})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Boxes / Cases</label>
                <input type="number" inputMode="numeric" value={entryBoxes} onChange={e => setEntryBoxes(e.target.value)} placeholder="0" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Loose Jars</label>
                <input type="number" inputMode="numeric" value={entryLooseUnits} onChange={e => setEntryLooseUnits(e.target.value)} placeholder="0" style={S.input} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Rate (₹/unit)</label>
                <input type="number" inputMode="decimal" value={entryRate} onChange={e => setEntryRate(e.target.value)} placeholder="Rate ₹" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Discount %</label>
                <input type="number" inputMode="decimal" value={entryDiscPct} onChange={e => setEntryDiscPct(e.target.value)} placeholder="0%" style={S.input} />
              </div>
            </div>

            <button onClick={addLineItem}
              style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
              <Plus size={16} /> Add Item to Invoice
            </button>
          </div>
        ) : (
          /* Desktop Grid Layout */
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Select Product</label>
              <select value={selectedProdId} onChange={e => handleProductSelect(e.target.value)} style={S.input}>
                <option value="">— Select Wholesale Product —</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `[${p.sku}]` : ''} · ₹{p.price}/{p.unit || 'unit'} (Stock: {p.stock || 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                Boxes / Cases {selectedProduct?.packSize ? `(${selectedProduct.packSize}/box)` : ''}
              </label>
              <input 
                type="number" 
                inputMode="numeric" 
                value={entryBoxes} 
                onChange={e => setEntryBoxes(e.target.value)} 
                placeholder="0" 
                style={S.input} 
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Loose Jars / Units</label>
              <input 
                type="number" 
                inputMode="numeric" 
                value={entryLooseUnits} 
                onChange={e => setEntryLooseUnits(e.target.value)} 
                placeholder="0" 
                style={S.input} 
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Rate (₹/unit)</label>
              <input 
                type="number" 
                inputMode="decimal" 
                value={entryRate} 
                onChange={e => setEntryRate(e.target.value)} 
                placeholder="Rate ₹" 
                style={S.input} 
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Discount %</label>
              <input 
                type="number" 
                inputMode="decimal" 
                value={entryDiscPct} 
                onChange={e => setEntryDiscPct(e.target.value)} 
                placeholder="0%" 
                style={S.input} 
              />
            </div>

            <button onClick={addLineItem}
              style={{ background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        )}
      </div>

      {/* SECTION 3: Invoice Line Items Table / Mobile Cards */}
      {cart.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0F172A' }}>
              Invoice Line Items ({cart.length})
            </h3>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>
              Total Units: {cart.reduce((s, i) => s + i.qty, 0)}
            </span>
          </div>

          {isMobile ? (
            /* Mobile Card List View for Items */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cart.map((item, idx) => (
                <div key={item.productId} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {item.sku ? `SKU: ${item.sku} ` : ''}{item.hsn ? `· HSN: ${item.hsn}` : ''}
                      </div>
                    </div>
                    <button onClick={() => removeLineItem(item.productId)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => updateLineQty(item.productId, -1)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, width: 26, height: 26, fontWeight: 800, cursor: 'pointer' }}>-</button>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{item.qty} units</span>
                      <button onClick={() => updateLineQty(item.productId, 1)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, width: 26, height: 26, fontWeight: 800, cursor: 'pointer' }}>+</button>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>₹{item.rate} / unit</div>
                      <div style={{ fontWeight: 900, fontSize: 15, color: '#0F172A' }}>₹{item.lineTotal.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop Table View */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 800 }}>#</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800 }}>Item Description</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Pack Breakdown</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Total Qty</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Disc %</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>GST %</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 8px', color: '#64748B', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {item.sku ? `SKU: ${item.sku} ` : ''}{item.hsn ? `· HSN: ${item.hsn}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {item.boxes > 0 && <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 800, marginRight: 4 }}>{item.boxes} Box{item.boxes > 1 ? 'es' : ''}</span>}
                        {item.looseUnits > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{item.looseUnits} Loose</span>}
                        {item.boxes === 0 && item.looseUnits === 0 && '—'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => updateLineQty(item.productId, -1)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, width: 22, height: 22, fontWeight: 800, cursor: 'pointer' }}>-</button>
                          <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                          <button onClick={() => updateLineQty(item.productId, 1)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, width: 22, height: 22, fontWeight: 800, cursor: 'pointer' }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>₹{item.rate}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: item.discPct > 0 ? '#DC2626' : '#64748B', fontWeight: 700 }}>{item.discPct > 0 ? `${item.discPct}%` : '—'}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#475569' }}>{item.gstRate}%</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, color: '#0F172A' }}>₹{item.lineTotal.toFixed(2)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button onClick={() => removeLineItem(item.productId)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 4: Logistics, Transport & Van Assignment */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '2px solid #F1F5F9' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#334155' }}>🚚 Delivery Logistics &amp; Transport Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Assign Delivery Van</label>
                <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} style={S.input}>
                  <option value="">— Direct Warehouse Dispatch —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.code} ({v.registrationNo || v.warehouseName || 'Delivery Vehicle'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Transport Carrier</label>
                <input value={transportName} onChange={e => setTransportName(e.target.value)} placeholder="e.g. Sompeta Express" style={S.input} />
              </div>
              <div>
                <label style={S.label}>L.R No.</label>
                <input value={lrNo} onChange={e => setLrNo(e.target.value)} placeholder="e.g. LR-8912" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Freight Charges ₹</label>
                <input type="number" inputMode="decimal" value={freightCharges} onChange={e => setFreightCharges(e.target.value)} placeholder="0" style={S.input} />
              </div>
            </div>
          </div>

          {/* SECTION 5: Tax Summary & Final Settlement Box */}
          <div style={{ marginTop: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={S.label}>Flat Invoice Discount ₹</label>
              <input type="number" inputMode="decimal" value={orderDiscount} onChange={e => setOrderDiscount(e.target.value)} placeholder="0" style={{ ...S.input, marginBottom: 12 }} />

              <label style={S.label}>Invoice Remarks / Order Notes</label>
              <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="e.g. Goods to be delivered before 5 PM" style={S.input} />
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Subtotal:</span>
                  <span style={{ fontWeight: 700 }}>₹{totals.taxableSubtotal.toFixed(2)}</span>
                </div>
                {totals.totalGst > 0 && (
                  <>
                    {!isInterstate ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>CGST:</span>
                          <span>₹{totals.cgst.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>SGST:</span>
                          <span>₹{totals.sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>IGST:</span>
                        <span>₹{totals.igst.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {totals.flatDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                    <span>Order Discount:</span>
                    <span>-₹{totals.flatDiscount.toFixed(2)}</span>
                  </div>
                )}
                {totals.freight > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563EB' }}>
                    <span>Freight Charges:</span>
                    <span>+₹{totals.freight.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 900, color: '#059669' }}>
                  <span>Grand Total:</span>
                  <span>₹{totals.grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Payment Mode & Submit Action */}
          <div style={{ marginTop: 20 }}>
            <label style={S.label}>Payment Method &amp; Ledger Posting</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { id: 'cash', label: '💵 Cash', desc: 'Instant Receipt' },
                { id: 'upi', label: '📱 UPI Payment', desc: 'Dynamic QR Link' },
                { id: 'credit', label: '🧾 Credit Ledger', desc: 'Post Debt to Shop' },
                { id: 'cheque', label: '🏦 Cheque / Bank', desc: 'Bank Transfer' },
              ].map(m => {
                const blocked = m.id === 'credit' && !shopId;
                return (
                  <button key={m.id} disabled={blocked} onClick={() => !blocked && setPayMode(m.id)}
                    style={{
                      flex: 1, padding: '12px 10px', borderRadius: 12, textAlign: 'center', cursor: blocked ? 'not-allowed' : 'pointer',
                      border: `2px solid ${payMode === m.id ? '#4F46E5' : '#E2E8F0'}`,
                      background: payMode === m.id ? '#EEF2FF' : '#FFFFFF',
                      color: payMode === m.id ? '#4338CA' : '#475569',
                      opacity: blocked ? 0.4 : 1,
                    }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{m.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>

            <button onClick={handleSubmitSale} disabled={busy}
              style={{ width: '100%', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#fff', border: 'none', padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px -4px rgba(5,150,105,0.35)' }}>
              <ShoppingCart size={20} /> {busy ? 'Generating GST Invoice…' : `Complete & Save ${docType === 'quotation' ? 'Quotation' : 'Tax Invoice'} (₹${totals.grandTotal.toLocaleString('en-IN')})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
