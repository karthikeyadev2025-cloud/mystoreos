/**
 * MobilePOS — POS terminal visible right under the search bar.
 *
 * Layout (top → bottom):
 *   1. Search bar + scan button — sticky at top, always reachable.
 *   2. POS Terminal panel — shows current bill items inline, customer
 *      phone, payment method, discount, total, and "Generate Bill" button.
 *      Collapses to a compact summary when bill is empty so the product
 *      list gets more room. Expanded when bill has items.
 *   3. Product list — dense rows below the terminal. Tap a row to add.
 *
 * No bottom sheets, no hidden states — the cashier always sees the bill.
 */
import { useState } from 'react';
import { Search, ScanLine, Plus, X, Trash2, ChevronUp, ChevronDown, Receipt, BarChart3 } from 'lucide-react';

export default function MobilePOS({
  products,
  filteredProducts,
  billItems,
  search,
  setSearch,
  addToBill,
  updateBillItemQty,
  removeBillItem,
  setShowScanner,
  setShowAddProductModal,
  setActiveTab,
  isOwner,
  flashSales,
  // Bill / checkout state from parent
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  paymentMethod, setPaymentMethod,
  manualDiscountPct, setManualDiscountPct,
  discountAmount, manualDiscountAmt,
  roundOff = 0, setRoundOff,
  billTotal,
  onCheckout,
  onPrint,
  onClearCart,
  onOpenDashboard,
  onShowUpiQr,
  updateBillItemDiscount,
}) {
  const [billExpanded, setBillExpanded] = useState(true);
  // Per-item discount: which row's discount editor is open
  const [discountRow, setDiscountRow] = useState(null);
  // Local loading state so the Generate Bill button shows progress while
  // the parent's sendWhatsAppBill is rendering the PDF + opening the share sheet.
  const [generating, setGenerating] = useState(false);
  const itemCount = billItems.reduce((s, i) => s + (i.qty || 1), 0);
  const rawFinalTotal = Math.max(0, (billTotal || 0) - ((discountAmount || 0) + (manualDiscountAmt || 0)));
  // Auto round-off remainder so the on-screen total matches the printed
  // receipt (line-item prices can be fractional). Manual entry wins: if
  // the cashier has typed a +/- round-off, we use exactly that; otherwise
  // we snap the fractional remainder to the nearest rupee.
  const autoRem = Math.round((Math.round(rawFinalTotal) - rawFinalTotal) * 100) / 100;
  const effRoundOff = (Number(roundOff) || 0) !== 0 ? (Number(roundOff) || 0) : autoRem;
  const finalTotal = Math.max(0, Math.round(rawFinalTotal + effRoundOff));

  // Auto round-off: snap to nearest whole rupee. See DesktopPOS for the
  // rationale — shopkeepers shouldn't have to type this every bill.
  const autoRoundOff = () => {
    const nearest = Math.round(rawFinalTotal);
    const delta = nearest - rawFinalTotal;
    setRoundOff && setRoundOff(Math.round(delta * 100) / 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#F8FAFC', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`@keyframes mp-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ─── 1. Sticky search bar + scan ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#F1F5F9', borderRadius: '10px', padding: '0 12px', border: '1px solid transparent', transition: 'border-color .15s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#4F46E5'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'transparent'}
        >
          <Search size={16} color="#64748B" />
          <input
            type="text"
            placeholder="Search product or scan"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filteredProducts.length > 0) {
                addToBill(filteredProducts[0]);
                setSearch('');
                e.preventDefault();
              }
            }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', padding: '12px 0', color: '#0F172A', minWidth: 0 }}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" style={{ background: '#E2E8F0', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>
        <button onClick={() => setShowScanner(true)} aria-label="Scan barcode" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '10px', background: '#4F46E5', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ScanLine size={20} />
        </button>
        {isOwner && onOpenDashboard && (
          <button onClick={onOpenDashboard} aria-label="Open dashboard" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <BarChart3 size={19} />
          </button>
        )}
      </div>

      {/* ─── 2. POS TERMINAL — visible right under search ─── */}
      <div style={{ margin: '10px 10px 0', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', overflow: 'hidden' }}>

        {/* Terminal gradient header — looks like a real cash drawer / POS device */}
        <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #4338CA 100%)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle pattern overlay for texture */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.08, background: 'radial-gradient(circle at top right, #fff 0%, transparent 50%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <Receipt size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>POS TERMINAL</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                {itemCount === 0 ? 'Ready · Tap a product to start' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in bill`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
            {itemCount > 0 && (
              <button onClick={() => { if (confirm('Clear this bill?')) onClearCart && onClearCart(); }} aria-label="Clear bill" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)' }}>
                <Trash2 size={11} /> Clear
              </button>
            )}
            <button onClick={() => setBillExpanded(v => !v)} aria-label={billExpanded ? 'Collapse' : 'Expand'} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(4px)' }}>
              {billExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {billExpanded && (
          <>
            {/* Bill items list */}
            {billItems.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 30, opacity: 0.35 }}>🛒</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Bill is empty</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Search a product or tap one below to add</div>
              </div>
            ) : (
              <div style={{ maxHeight: '32vh', overflowY: 'auto' }}>
                {billItems.map((item, idx) => {
                  const lineBase = item.price * item.qty;
                  const iDisc = Math.min(99, Number(item.itemDiscount) || 0);
                  const iDiscAmt = iDisc > 0 ? Math.round(lineBase * iDisc / 100) : 0;
                  const lineNet = lineBase - iDiscAmt;
                  const showingDisc = discountRow === item.id;
                  return (
                    <div key={item.id} style={{ borderBottom: idx === billItems.length - 1 ? 'none' : '1px solid #F1F5F9', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                        <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span>₹{item.price} × {item.qty}</span>
                            {iDisc > 0 ? (
                              <>
                                <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>₹{lineBase}</span>
                                <span style={{ background: '#DCFCE7', color: '#15803D', padding: '0 5px', borderRadius: 4, fontWeight: 700 }}>−{iDisc}%</span>
                                <span style={{ fontWeight: 800, color: '#15803D' }}>₹{lineNet}</span>
                              </>
                            ) : (
                              <span style={{ fontWeight: 700, color: '#0F172A' }}>= ₹{lineBase}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                          <button onClick={() => updateBillItemQty(item.id, -1)} aria-label="Decrease" style={{ width: 28, height: 28, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{item.qty}</span>
                          <button onClick={() => updateBillItemQty(item.id, 1)} aria-label="Increase" style={{ width: 28, height: 28, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>+</button>
                        </div>
                        {updateBillItemDiscount && (
                          <button
                            onClick={() => setDiscountRow(showingDisc ? null : item.id)}
                            aria-label="Discount this item"
                            style={{
                              background: iDisc > 0 ? '#DCFCE7' : 'transparent',
                              border: iDisc > 0 ? '1px solid #86EFAC' : '1px solid transparent',
                              color: iDisc > 0 ? '#15803D' : '#94A3B8',
                              cursor: 'pointer', padding: '4px 6px',
                              borderRadius: 6, fontSize: 11, fontWeight: 800,
                              minWidth: 28,
                            }}
                          >
                            %
                          </button>
                        )}
                        <button onClick={() => removeBillItem(item.id)} aria-label="Remove" style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {showingDisc && updateBillItemDiscount && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAFB' }}>
                          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, flexShrink: 0 }}>Item discount</span>
                          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                            {[0, 5, 10, 15, 20].map(pct => (
                              <button
                                key={pct}
                                onClick={() => updateBillItemDiscount(item.id, pct)}
                                style={{
                                  flex: 1, padding: '6px 0',
                                  background: iDisc === pct ? '#4F46E5' : '#FFFFFF',
                                  border: '1px solid ' + (iDisc === pct ? '#4F46E5' : '#E2E8F0'),
                                  color: iDisc === pct ? '#fff' : '#475569',
                                  borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                {pct === 0 ? 'None' : pct + '%'}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min="0" max="99"
                            placeholder="Custom"
                            value={[0,5,10,15,20].includes(iDisc) ? '' : (iDisc || '')}
                            onChange={e => updateBillItemDiscount(item.id, Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
                            inputMode="decimal"
                            style={{ width: 50, padding: '6px 6px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11, color: '#0F172A', textAlign: 'center', outline: 'none' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customer + payment + discount (compact, only visible when items exist) */}
            {itemCount > 0 && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>

                {/* Customer name + phone */}
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 5 }}>Customer <span style={{ fontWeight: 500, opacity: 0.7 }}>(Optional)</span></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Name"
                      value={customerName || ''}
                      onChange={e => setCustomerName && setCustomerName(e.target.value)}
                      style={{ flex: 1.2, minWidth: 0, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5, color: '#0F172A', outline: 'none' }}
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={customerPhone || ''}
                      onChange={e => setCustomerPhone && setCustomerPhone(e.target.value)}
                      inputMode="tel"
                      style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5, color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Payment method — 4 segmented buttons with icons */}
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 5 }}>Payment Method</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 4 }}>
                    {[
                      { key: 'Cash', label: 'Cash', icon: '💵', color: '#10B981' },
                      { key: 'UPI', label: 'UPI', icon: '📱', color: '#4F46E5' },
                      { key: 'Card', label: 'Card', icon: '💳', color: '#0EA5E9' },
                      { key: 'Credit', label: 'Credit', icon: '📒', color: '#F59E0B' },
                    ].map(p => {
                      const selected = paymentMethod === p.key;
                      return (
                        <button
                          key={p.key}
                          onClick={() => {
                            setPaymentMethod && setPaymentMethod(p.key);
                            // Tap UPI = also pop up the UPI QR for the customer to scan immediately.
                            // This is the heart of fast-billing in India: cashier picks UPI →
                            // QR is on screen → customer scans → done. No extra tap needed.
                            if (p.key === 'UPI' && onShowUpiQr) onShowUpiQr();
                          }}
                          style={{
                            padding: '8px 4px',
                            background: selected ? p.color : 'transparent',
                            border: 'none',
                            color: selected ? '#fff' : '#64748B',
                            borderRadius: 6,
                            fontSize: 11.5, fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            transition: 'all .15s',
                            boxShadow: selected ? `0 2px 6px ${p.color}55` : 'none',
                          }}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{p.icon}</span>
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Discount + Subtotal/Discount/Total summary */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Subtotal</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>₹{billTotal || 0}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Discount
                      <input
                        type="number"
                        placeholder="0"
                        value={manualDiscountPct || ''}
                        onChange={e => setManualDiscountPct && setManualDiscountPct(e.target.value)}
                        inputMode="decimal"
                        min="0" max="100"
                        style={{ width: 38, padding: '2px 4px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 12, color: '#0F172A', textAlign: 'center', outline: 'none' }}
                      />
                      %
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>−₹{(discountAmount || 0) + (manualDiscountAmt || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Round Off</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button
                        type="button"
                        onClick={autoRoundOff}
                        style={{ padding: '4px 8px', background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>
                        Auto
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={roundOff || ''}
                        onChange={e => setRoundOff && setRoundOff(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        style={{ width: 62, padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, color: '#0F172A', textAlign: 'right', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #E2E8F0', paddingTop: 8 }}>
                    <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 800 }}>TOTAL</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' }}>₹{finalTotal}</span>
                  </div>
                </div>

                {/* Generate Bill button */}
                <button
                  onClick={async () => {
                    if (generating || !onCheckout) return;
                    setGenerating(true);
                    try { await onCheckout(); }
                    finally {
                      setTimeout(() => setGenerating(false), 1200);
                    }
                  }}
                  disabled={generating}
                  style={{
                    width: '100%',
                    background: generating ? '#94A3B8' : 'linear-gradient(135deg,#10B981,#059669)',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: generating ? 'wait' : 'pointer',
                    boxShadow: generating ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '0.3px',
                    transition: 'all .15s',
                  }}
                >
                  {generating ? (
                    <>
                      <span className="mobile-pos-spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'mp-spin 0.7s linear infinite' }} />
                      Generating…
                    </>
                  ) : (
                    <>✓ Generate Bill · ₹{finalTotal}</>
                  )}
                </button>
                {/* Print button */}
                {onPrint && (
                  <button
                    onClick={onPrint}
                    style={{ width: '100%', background: '#F8FAFC', color: '#0F172A', border: '1px solid #E2E8F0', padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}
                  >
                    🖨️ Print Bill
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── 3. Product list ─── */}
      <div style={{ flex: 1, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        {filteredProducts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 36, opacity: 0.3 }}>🔍</div>
            {search ? (
              <>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>No product matching "{search}"</p>
                {isOwner && (
                  <button onClick={() => { setShowAddProductModal(true); setSearch(''); }} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={14} /> Add as new product
                  </button>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 14 }}>No products yet. Tap + to add your first.</p>
            )}
          </div>
        ) : (
          filteredProducts.map(p => {
            const outOfStock = (p.stock || 0) <= 0;
            const inCart = billItems.find(b => b.id === p.id);
            const sale = flashSales[p.id];
            const activeSale = sale && new Date(sale.expiresAt) > new Date();
            const standingDiscPct = Math.min(99, Number(p.discountPct) || 0);
            const hasDiscount = activeSale || standingDiscPct > 0;
            const salePrice = activeSale
              ? Math.max(0, Math.round(p.price * (1 - sale.discount / 100)))
              : standingDiscPct > 0
                ? Math.max(0, Math.round(p.price * (1 - standingDiscPct / 100)))
                : p.price;
            const lowStock = !outOfStock && p.stock < (p.reorderLevel || 10);
            return (
              <button
                key={p.id}
                onClick={() => !outOfStock && addToBill(p)}
                disabled={outOfStock}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: '1px solid #E2E8F0',
                  cursor: outOfStock ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: outOfStock ? 0.5 : 1,
                  WebkitTapHighlightColor: 'rgba(79,70,229,0.15)',
                }}
              >
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  {(p.image || (p.images && p.images[0])) ? (
                    <img src={p.image || p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>{(p.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: outOfStock ? '#EF4444' : lowStock ? '#F59E0B' : '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span>{outOfStock ? 'Out of stock' : `Stock: ${p.stock}`}</span>
                    {hasDiscount && !outOfStock && (
                      <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {activeSale ? `${sale.discount}% off` : `${standingDiscPct}% off`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 60 }}>
                  {hasDiscount && !outOfStock ? (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#EF4444' }}>₹{salePrice}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>₹{p.price}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>₹{p.price}</span>
                  )}
                  {inCart && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#4F46E5', padding: '2px 8px', borderRadius: 999, minWidth: 24, textAlign: 'center' }}>
                      ×{inCart.qty}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating + button for adding new products (owner only) */}
      {isOwner && (
        <button
          onClick={() => setShowAddProductModal(true)}
          aria-label="Add new product"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            width: 52, height: 52, borderRadius: '50%',
            background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#4F46E5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
            cursor: 'pointer', zIndex: 90,
          }}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}
