/**
 * MobilePOS — fast-billing screen designed for one-thumb operation.
 *
 * Design follows what Square POS / Loyverse / MyBillBook / Vyapar do on a
 * phone:
 *   - Fixed search bar at the very top (always reachable, never scrolls away).
 *   - Dense product LIST (not a card grid) — each row is one tap to add.
 *   - Tap a product row = +1 to cart immediately (no "view detail → add").
 *   - Cart lives in a fixed bottom bar showing total + item count. Tap to
 *     open a full-screen bill review / checkout sheet.
 *   - No promo banners, AI cards, stat tiles, or 7-button action grids on
 *     this screen. That stuff belongs on a separate Insights / Reports tab.
 *
 * Cashier opens app → already on this screen → types 2 letters → taps
 * matching row → cart counter goes up → tap bottom bar to checkout. Five
 * seconds end to end.
 */
import { useEffect, useState } from 'react';
import { Search, ScanLine, Plus, Receipt, X, Trash2 } from 'lucide-react';

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
  // checkout panel slot — the existing complex checkout / payment / customer
  // UI from DesktopPOS is wrapped and rendered inside the bottom sheet via
  // this slot so we don't duplicate that logic.
  checkoutSlot,
  onCheckout,
  onClearCart,
  billTotal,
  discountAmount,
  manualDiscountAmt,
}) {
  const [showCart, setShowCart] = useState(false);

  const itemCount = billItems.reduce((s, i) => s + (i.qty || 1), 0);
  const finalTotal = Math.max(0, (billTotal || 0) - ((discountAmount || 0) + (manualDiscountAmt || 0)));

  // Auto-open the cart sheet the first time a product is added — gives the
  // cashier visual confirmation without forcing them to tap.
  useEffect(() => {
    if (itemCount === 1) setShowCart(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount > 0 ? 1 : 0]);

  // Lock body scroll when the cart sheet is open
  useEffect(() => {
    document.body.style.overflow = showCart ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showCart]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', background: '#F8FAFC' }}>
      {/* ── Fixed search bar — always at the top ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#F1F5F9', borderRadius: '10px', padding: '0 12px', border: '1px solid transparent', transition: 'border-color .15s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#4F46E5'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'transparent'}
        >
          <Search size={16} color="#64748B" />
          <input
            type="text"
            placeholder="Search product or scan barcode"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filteredProducts.length > 0) {
                addToBill(filteredProducts[0]);
                setSearch('');
                e.preventDefault();
              }
            }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', padding: '12px 0', color: '#0F172A' }}
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

      {/* ── Dense product list (Square POS pattern, not a card grid) ── */}
      <div style={{ flex: 1, padding: '6px 0 120px' }}>
        {filteredProducts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 44, opacity: 0.3 }}>🔍</div>
            {search ? (
              <>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>No product matching "{search}"</p>
                {isOwner && (
                  <button onClick={() => { setShowAddProductModal(true); setSearch(''); }} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={14} /> Add "{search}" as new
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
                  gap: '12px',
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: '1px solid #E2E8F0',
                  cursor: outOfStock ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: outOfStock ? 0.5 : 1,
                  transition: 'background 0.1s',
                  WebkitTapHighlightColor: 'rgba(79,70,229,0.15)',
                }}
              >
                {/* Thumbnail or category icon */}
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  {(p.image || (p.images && p.images[0])) ? (
                    <img src={p.image || p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>{(p.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {/* Name + secondary line */}
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
                {/* Price + qty pill */}
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

      {/* ── Floating Action Button: Add Product (owner only) ── */}
      {isOwner && (
        <button
          onClick={() => setShowAddProductModal(true)}
          aria-label="Add new product"
          style={{
            position: 'fixed',
            right: 16,
            bottom: `calc(${itemCount > 0 ? '146' : '82'}px + env(safe-area-inset-bottom, 0px))`,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            color: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
            cursor: 'pointer',
            zIndex: 90,
            transition: 'bottom 0.2s',
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── Sticky cart bar (visible only when there's a bill) ── */}
      {itemCount > 0 && (
        <button
          onClick={() => setShowCart(true)}
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: `calc(64px + env(safe-area-inset-bottom, 0px))`,
            width: 'calc(100% - 16px)',
            maxWidth: 480,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg,#4F46E5,#4338CA)',
            color: '#fff',
            border: 'none',
            padding: '14px 20px',
            borderRadius: 14,
            boxShadow: '0 -4px 20px rgba(79,70,229,0.4)',
            zIndex: 95,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'rgba(255,255,255,0.22)', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{itemCount}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>View Bill</span>
          </span>
          <span style={{ fontSize: 18, fontWeight: 900 }}>₹{finalTotal}</span>
        </button>
      )}

      {/* ── Cart / Checkout bottom sheet ── */}
      {showCart && (
        <div
          onClick={() => setShowCart(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              background: '#FFFFFF',
              borderRadius: '20px 20px 0 0',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 30px rgba(15,23,42,0.2)',
            }}
          >
            {/* Sheet header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={18} color="#4F46E5" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Bill · {itemCount} {itemCount === 1 ? 'item' : 'items'}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {itemCount > 0 && onClearCart && (
                  <button onClick={() => { if (confirm('Clear all items from this bill?')) { onClearCart(); setShowCart(false); } }} aria-label="Clear bill" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#EF4444', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
                <button onClick={() => setShowCart(false)} aria-label="Close" style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} color="#64748B" />
                </button>
              </div>
            </div>

            {/* Bill items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {billItems.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8' }}>Bill is empty.</div>
              ) : (
                billItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                      <button onClick={() => updateBillItemQty(item.id, -1)} aria-label="Decrease" style={{ width: 32, height: 32, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{item.qty}</span>
                      <button onClick={() => updateBillItemQty(item.id, 1)} aria-label="Increase" style={{ width: 32, height: 32, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#4F46E5', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>+</button>
                    </div>
                    <button onClick={() => removeBillItem(item.id)} aria-label="Remove" style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer: total + checkout. The checkoutSlot (custom payment /
                customer / discount UI from the parent) renders ABOVE this
                summary if provided. */}
            {checkoutSlot && (
              <div style={{ borderTop: '1px solid #E2E8F0', maxHeight: '38vh', overflowY: 'auto', background: '#F8FAFC' }}>
                {checkoutSlot}
              </div>
            )}

            {billItems.length > 0 && (
              <div style={{ borderTop: '1px solid #E2E8F0', padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>₹{finalTotal}</div>
                </div>
                {onCheckout && (
                  <button
                    onClick={() => onCheckout()}
                    style={{ flex: 1, maxWidth: 220, background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', padding: '14px 18px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    Generate Bill →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
