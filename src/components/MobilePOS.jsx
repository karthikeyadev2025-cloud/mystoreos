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
import { Search, ScanLine, Plus, X, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

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
  billTotal,
  onCheckout,
  onClearCart,
}) {
  // Expand/collapse the bill list — auto-expands when items > 0, but the
  // cashier can collapse it manually to see more products.
  const [billExpanded, setBillExpanded] = useState(true);
  const itemCount = billItems.reduce((s, i) => s + (i.qty || 1), 0);
  const finalTotal = Math.max(0, (billTotal || 0) - ((discountAmount || 0) + (manualDiscountAmt || 0)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#F8FAFC', minHeight: '100vh' }}>

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
      </div>

      {/* ─── 2. POS TERMINAL — visible right under search ─── */}
      <div style={{ background: '#FFFFFF', borderBottom: '8px solid #F1F5F9', boxShadow: '0 2px 6px rgba(15,23,42,0.04)' }}>

        {/* Terminal header */}
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14 }}>🧾</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>POS Terminal</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{itemCount === 0 ? 'No items yet' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ₹${finalTotal}`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {itemCount > 0 && (
              <button onClick={() => { if (confirm('Clear bill?')) onClearCart && onClearCart(); }} aria-label="Clear bill" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#EF4444', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={12} /> Clear
              </button>
            )}
            <button onClick={() => setBillExpanded(v => !v)} aria-label={billExpanded ? 'Collapse bill' : 'Expand bill'} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
              {billExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {billExpanded && (
          <>
            {/* Bill items list */}
            {billItems.length === 0 ? (
              <div style={{ padding: '14px 14px 18px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                Search or scan a product to start a bill
              </div>
            ) : (
              <div style={{ maxHeight: '32vh', overflowY: 'auto', borderTop: '1px solid #F1F5F9' }}>
                {billItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                      <button onClick={() => updateBillItemQty(item.id, -1)} aria-label="Decrease" style={{ width: 30, height: 30, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: 26, textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{item.qty}</span>
                      <button onClick={() => updateBillItemQty(item.id, 1)} aria-label="Increase" style={{ width: 30, height: 30, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>+</button>
                    </div>
                    <button onClick={() => removeBillItem(item.id)} aria-label="Remove" style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Customer + payment + discount (compact, only visible when items exist) */}
            {itemCount > 0 && (
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #F1F5F9', background: '#FAFAFB' }}>
                {/* Customer name + phone in one row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Customer name (optional)"
                    value={customerName || ''}
                    onChange={e => setCustomerName && setCustomerName(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#0F172A' }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={customerPhone || ''}
                    onChange={e => setCustomerPhone && setCustomerPhone(e.target.value)}
                    inputMode="tel"
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#0F172A' }}
                  />
                </div>

                {/* Payment method — 4 segmented buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[
                    { key: 'Cash', label: 'Cash', color: '#10B981' },
                    { key: 'UPI', label: 'UPI', color: '#4F46E5' },
                    { key: 'Card', label: 'Card', color: '#0EA5E9' },
                    { key: 'Credit', label: 'Credit', color: '#F59E0B' },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPaymentMethod && setPaymentMethod(p.key)}
                      style={{
                        padding: '8px 4px',
                        background: paymentMethod === p.key ? `${p.color}14` : '#FFFFFF',
                        border: paymentMethod === p.key ? `2px solid ${p.color}` : '1px solid #E2E8F0',
                        color: paymentMethod === p.key ? p.color : '#475569',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Discount % + Total in one row */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Disc %</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={manualDiscountPct || ''}
                      onChange={e => setManualDiscountPct && setManualDiscountPct(e.target.value)}
                      inputMode="decimal"
                      min="0" max="100"
                      style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>₹{finalTotal}</div>
                  </div>
                </div>

                {/* Generate Bill button */}
                <button
                  onClick={() => onCheckout && onCheckout()}
                  style={{ width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
                >
                  Generate Bill →
                </button>
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
