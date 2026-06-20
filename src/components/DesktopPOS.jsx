import { useState } from 'react';
import { Search, ScanLine, Plus, IndianRupee, Book, Receipt, Share2, Package, X, QrCode, Trash2, Tag } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { resolveUnit, UNIT_SUFFIX } from '../lib/units';

const PAY_METHODS = [
  { key: 'Cash',   icon: '💵', color: '#10B981' },
  { key: 'UPI',    icon: '📱', color: '#4F46E5' },
  { key: 'Card',   icon: '💳', color: '#3B82F6' },
  { key: 'Credit', icon: '📒', color: '#EF4444' },
];

const DesktopPOS = ({
  footerSlot,
  products,
  filteredProducts,
  billItems,
  customItemName,
  setCustomItemName,
  customItemPrice,
  setCustomItemPrice,
  billingMode,
  setBillingMode,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerGstin,
  setCustomerGstin,
  customerAddress,
  setCustomerAddress,
  customerStateCode,
  setCustomerStateCode,
  discountAmount,
  billTotal,
  search,
  setSearch,
  pendingOrders,
  sales,
  payable,
  isOwner,
  setShowScanner,
  handleShowUpiQr,
  addCustomItem,
  updateBillItemQty,
  updateBillItemVariant,
  removeBillItem,
  manualDiscountPct = 0,
  setManualDiscountPct,
  manualDiscountAmt = 0,
  sendWhatsAppBill,
  addToBill,
  setActiveTab,
  setShowAddProductModal,
  loyaltyEnabled = false,
  customerLoyaltyPoints = 0,
  loyaltyRedeem = 0,
  setLoyaltyRedeem,
  dailyTarget = 0,
  handleSetDailyTarget,
  flashSales = {},
  shopCategory = 'general',
  // NEW: payment method + clear cart + item discount
  paymentMethod,
  setPaymentMethod,
  onClearCart,
  updateBillItemDiscount,
  // scan popup
  scanPopupProduct,
  onScanPopupAdd,
  onScanPopupClose,
}) => {
  const { hasFeature } = useSubscription();
  const canShare = hasFeature('whatsappShare');
  const [targetInput, setTargetInput] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState(null); // which cart item shows discount input
  const [showCustomerDetails, setShowCustomerDetails] = useState(false); // collapsed by default — cart needs the room

  const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10);
  const maxRedeemable = Math.floor(customerLoyaltyPoints / 10) * 10;

  const CIRC = 2 * Math.PI * 28;
  const targetPct = dailyTarget > 0 ? Math.min(1, sales / dailyTarget) : 0;
  const ringOffset = CIRC * (1 - targetPct);
  const targetPctInt = Math.round(targetPct * 100);
  const ringColor = targetPctInt >= 100 ? '#10B981' : targetPctInt >= 60 ? '#F59E0B' : '#EF4444';
  const motivation = targetPctInt >= 100 ? '🎉 Target Hit!' : targetPctInt >= 80 ? '💪 Almost There!' : targetPctInt >= 50 ? '📈 Keep Going!' : '🚀 Start Billing!';
  const lowStockProducts = products.filter(p => p.stock < (p.reorderLevel || 10));

  const finalTotal = Math.max(0, billTotal - (discountAmount + manualDiscountAmt) - loyaltyDiscountRupees);

  return (
    <div className="responsive-split-grid" style={{ alignItems: 'start' }}>

      {/* ── Left Column ── */}
      <div className="pos-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* AI Inventory Warning */}
        {lowStockProducts.length > 0 && (
          <div className="premium-glass pos-ai-warning" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>🤖</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#991B1B', fontWeight: 'bold' }}>AI Inventory Warning</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#7F1D1D', lineHeight: '1.4' }}>
                Low stock on <b>{lowStockProducts.map(p => p.name).join(', ')}</b>. Based on your sales trend, you may run out soon.
              </p>
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="pos-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('bills')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', cursor: 'pointer' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>New Orders</p>
            <p style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>{pendingOrders}</p>
            {pendingOrders > 0 && <p style={{ fontSize: '12px', fontWeight: '600', color: '#F59E0B', margin: '4px 0 0' }}>Needs attention</p>}
          </div>
          {isOwner && (
            <div className="premium-glass" style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Today's Sales</p>
              <p style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>₹{sales}</p>
            </div>
          )}
          <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('products')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', cursor: 'pointer' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Total Products</p>
            <p style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>{products.length}</p>
          </div>
          {isOwner && (
            <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('credit')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', cursor: 'pointer' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Supplier Credit</p>
              <p style={{ fontSize: '26px', fontWeight: '800', color: payable > 0 ? '#EF4444' : '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>₹{payable}</p>
            </div>
          )}
        </div>

        {/* Daily Target Progress Ring */}
        {isOwner && (
          <div className="premium-glass pos-daily-target" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            {dailyTarget > 0 ? (
              <>
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                  <circle cx="40" cy="40" r="28" fill="none" stroke={ringColor} strokeWidth="7"
                    strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                    strokeLinecap="round" transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                  <text x="40" y="45" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="bold" fontFamily="Plus Jakarta Sans, sans-serif">{targetPctInt}%</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '2px' }}>{motivation}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>₹{sales.toLocaleString('en-IN')} of ₹{dailyTarget.toLocaleString('en-IN')} daily target</div>
                  <button onClick={() => setShowTargetInput(v => !v)} style={{ fontSize: '10px', color: '#4F46E5', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Change Target</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🎯</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>Set a Daily Sales Target</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Track your progress toward a daily revenue goal</div>
                </div>
              </div>
            )}
            {(showTargetInput || dailyTarget === 0) && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#64748B', fontSize: '13px' }}>₹</span>
                <input type="number" placeholder="e.g. 5000" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                  style={{ width: '90px', padding: '6px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
                <button onClick={() => { handleSetDailyTarget && handleSetDailyTarget(targetInput); setTargetInput(''); setShowTargetInput(false); }}
                  style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Set</button>
              </div>
            )}
          </div>
        )}

        {/* Search & Quick Actions */}
        <div className="premium-glass pos-search-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#F1F5F9', borderRadius: '10px', padding: '4px 16px', border: '2px solid transparent', outline: 'none', marginBottom: '16px', transition: 'border-color .15s' }}
            onFocusCapture={e => e.currentTarget.style.borderColor = '#4F46E5'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <Search size={16} color="#64748B" style={{ flexShrink: 0 }} />
            <input type="text"
              placeholder="Search by name, barcode, or price…  (/ to focus · Enter = add top)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && filteredProducts.length > 0) {
                  addToBill(filteredProducts[0]);
                  setSearch('');
                  e.preventDefault();
                }
                if (e.key === 'Escape') setSearch('');
              }}
              style={{ background: 'transparent', border: 'none', margin: 0, color: '#0F172A', width: '100%', padding: '12px 0', outline: 'none', fontSize: '15px' }} />
            {search && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#4F46E5', fontWeight: 700 }}>{filteredProducts.length} found</span>
                <button onClick={() => setSearch('')} style={{ background: '#E2E8F0', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
            {!search && (
              <kbd style={{ fontSize: 11, color: '#94A3B8', background: '#E2E8F0', border: '1px solid #CBD5E1', borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>/</kbd>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <button className="premium-btn" onClick={() => setShowScanner(true)} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <ScanLine size={20} color="#4F46E5" />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Barcode Scan</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => { setActiveTab('products'); setShowAddProductModal(true); }} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <Plus size={20} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Add Product</span>
              </button>
            )}
            <button className="premium-btn" onClick={handleShowUpiQr} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <IndianRupee size={20} color="#D97706" />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>UPI QR Code</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => setActiveTab('credit')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <Book size={20} color="#6366F1" />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Credit Ledger</span>
              </button>
            )}
            <button className="premium-btn" onClick={() => setActiveTab('bills')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <Receipt size={20} color={pendingOrders > 0 ? '#EF4444' : '#64748B'} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>All Bills</span>
            </button>
          </div>
        </div>

        {/* Product Grid — smart search results or full grid */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="#D97706" />
            {search ? `Results for "${search}" — ${filteredProducts.length} found` : 'Quick Shelf Explorer'}
            {search && filteredProducts.length > 0 && (
              <span style={{ fontSize: 11, color: '#4F46E5', background: '#EEF2FF', padding: '2px 8px', borderRadius: 6, fontWeight: 600, marginLeft: 'auto' }}>↵ Enter adds first</span>
            )}
          </h3>

          {/* Search results as list (faster to scan when searching) */}
          {search ? (
            filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748B' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No product matching "{search}"</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Try partial name, barcode, or price</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredProducts.slice(0, 12).map((p, idx) => {
                  const outOfStock = (p.stock || 0) <= 0;
                  const inCart = billItems.find(b => b.id === p.id);
                  const q = search.toLowerCase();
                  const nameL = (p.name || '').toLowerCase();
                  const matchIdx = nameL.indexOf(q);
                  const name = p.name || '';
                  const highlighted = matchIdx !== -1
                    ? <>{name.slice(0, matchIdx)}<mark style={{ background: '#FDE68A', borderRadius: 2, padding: '0 1px' }}>{name.slice(matchIdx, matchIdx + q.length)}</mark>{name.slice(matchIdx + q.length)}</>
                    : name;
                  const sale = flashSales[p.id];
                  const activeSale = sale && new Date(sale.expiresAt) > new Date();
                  const standingDiscPct = Math.min(99, Number(p.discountPct) || 0);
                  const hasDiscount = activeSale || standingDiscPct > 0;
                  const displayPrice = activeSale
                    ? Math.max(0, Math.round(p.price * (1 - sale.discount / 100)))
                    : standingDiscPct > 0
                      ? Math.max(0, Math.round(p.price * (1 - standingDiscPct / 100)))
                      : p.price;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: idx === 0 ? '#EEF2FF' : '#F8FAFC', border: `1px solid ${idx === 0 ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '10px', opacity: outOfStock ? 0.55 : 1 }}>
                      {(p.image || (p.images && p.images[0])) && (
                        <img src={p.image || p.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{highlighted}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: hasDiscount ? '#EF4444' : '#4F46E5' }}>₹{displayPrice}</span>
                          {hasDiscount && <span style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>₹{p.price}</span>}
                          {!activeSale && standingDiscPct > 0 && <span style={{ fontSize: 10, background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{standingDiscPct}% OFF</span>}
                          <span style={{ fontSize: 11, color: outOfStock ? '#EF4444' : p.stock < 5 ? '#F59E0B' : '#94A3B8' }}>
                            {outOfStock ? '● Out of stock' : p.stock < 5 ? `⚠ ${p.stock} left` : `Stock: ${p.stock}`}
                          </span>
                          {inCart && <span style={{ fontSize: 10, background: '#4F46E5', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>×{inCart.qty} in bill</span>}
                        </div>
                      </div>
                      <button
                        disabled={outOfStock}
                        onClick={() => !outOfStock && addToBill(p)}
                        style={{ background: outOfStock ? '#E2E8F0' : inCart ? '#059669' : '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: 13, cursor: outOfStock ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                      >
                        {inCart ? `+1` : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Normal grid view when not searching */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '18px', alignContent: 'start' }}>
            {filteredProducts.map(p => {
              const lowStock   = p.stock < (p.reorderLevel || 10);
              const sale       = flashSales[p.id];
              const activeSale = sale && new Date(sale.expiresAt) > new Date();
              const standingDiscPct = Math.min(99, Number(p.discountPct) || 0);
              const hasDiscount = activeSale || standingDiscPct > 0;
              const salePrice  = activeSale
                ? Math.max(0, Math.round(p.price * (1 - sale.discount / 100)))
                : standingDiscPct > 0
                  ? Math.max(0, Math.round(p.price * (1 - standingDiscPct / 100)))
                  : null;
              const minsLeft   = activeSale ? Math.max(0, Math.round((new Date(sale.expiresAt) - new Date()) / 60000)) : 0;
              const timeLabel  = minsLeft >= 60 ? `${Math.floor(minsLeft / 60)}h left` : `${minsLeft}m left`;
              const outOfStock = (p.stock || 0) <= 0;
              return (
                <div key={p.id} className="premium-glass" style={{ padding: '14px', paddingTop: hasDiscount || outOfStock ? '34px' : '14px', borderRadius: '16px', background: outOfStock ? '#F8FAFC' : hasDiscount ? '#FEF2F2' : '#FFFFFF', border: `1px solid ${outOfStock ? '#E2E8F0' : hasDiscount ? '#FCA5A5' : '#E2E8F0'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', opacity: outOfStock ? 0.6 : 1 }}>
                  {activeSale && !outOfStock && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '800', padding: '5px 10px', borderRadius: '0 14px 0 10px', whiteSpace: 'nowrap' }}>
                      🔥 -{sale.discount}% · {timeLabel}
                    </div>
                  )}
                  {!activeSale && standingDiscPct > 0 && !outOfStock && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '800', padding: '5px 10px', borderRadius: '0 14px 0 10px', whiteSpace: 'nowrap' }}>
                      🏷️ -{standingDiscPct}%
                    </div>
                  )}
                  {outOfStock && (
                    <div style={{ position: 'absolute', top: 0, left: 0, background: '#94A3B8', color: 'white', fontSize: '10px', fontWeight: '800', padding: '5px 10px', borderRadius: '0 0 10px 0', whiteSpace: 'nowrap' }}>
                      OUT OF STOCK
                    </div>
                  )}
                  <div>
                    {(p.image || (p.images && p.images[0])) && (
                      <img src={p.image || p.images[0]} alt={p.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E2E8F0' }} />
                    )}
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{p.name}</h4>
                    {hasDiscount && !outOfStock ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#EF4444' }}>₹{salePrice}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', textDecoration: 'line-through' }}>₹{p.price}</p>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#4F46E5' }}>₹{p.price}</p>
                    )}
                    <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: outOfStock ? '#94A3B8' : lowStock ? '#EF4444' : '#64748B', fontWeight: (lowStock && !outOfStock) ? 'bold' : 'normal' }}>
                      {outOfStock ? 'Out of stock' : `Stock: ${p.stock}`}{lowStock && !outOfStock ? ' ⚠️' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => !outOfStock && addToBill(p)}
                    disabled={outOfStock}
                    style={{ background: outOfStock ? '#F1F5F9' : 'rgba(79,70,229,0.08)', border: `1px solid ${outOfStock ? '#E2E8F0' : 'rgba(79,70,229,0.25)'}`, color: outOfStock ? '#94A3B8' : '#4F46E5', width: '100%', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: outOfStock ? 'not-allowed' : 'pointer', marginTop: '12px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { if (!outOfStock) { e.currentTarget.style.background = '#4F46E5'; e.currentTarget.style.color = '#fff'; }}}
                    onMouseLeave={e => { if (!outOfStock) { e.currentTarget.style.background = 'rgba(79,70,229,0.08)'; e.currentTarget.style.color = '#4F46E5'; }}}
                  >
                    {outOfStock ? 'Unavailable' : '+ Add to Cart'}
                  </button>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 16px', color: '#64748B' }}>
                <Package size={40} style={{ opacity: 0.2 }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>No products found</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Try a different search, or add your first product</p>
              </div>
            )}
          </div>
          )} {/* end grid ternary */}
        </div>
        {footerSlot}
      </div>

      {/* ── Right Column: POS Cart ── */}
      <div className="premium-glass pos-cart-panel" style={{ borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', position: 'sticky', top: '0', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', overflow: 'hidden' }}>

        {/* ── PINNED TOP: Header + Billing Mode + Customer toggle ── */}
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="#64748B" /> POS Terminal
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {billItems.length > 0 && (
                <button onClick={onClearCart} title="Clear cart" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#EF4444', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }}>
                  <Trash2 size={12} /> Clear
                </button>
              )}
              <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10B981', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                {billItems.length} item{billItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Billing Mode */}
          <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '4px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '10px' }}>
            {[['bill','Bill','#10B981'],['estimate','Estimate','#D97706'],['challan','Challan','#3B82F6']].map(([mode, label, color]) => (
              <button key={mode} onClick={() => setBillingMode(mode)} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none', background: billingMode === mode ? `rgba(${mode === 'bill' ? '16,185,129' : mode === 'estimate' ? '245,158,11' : '59,130,246'},0.2)` : 'transparent', color: billingMode === mode ? color : '#64748B' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Customer Details — collapsible (saves space for the cart) */}
          <button
            onClick={() => setShowCustomerDetails(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: showCustomerDetails ? '12px 12px 0 0' : '12px', padding: '9px 12px', cursor: 'pointer', marginBottom: 0 }}
          >
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Customer Details
              {(customerName || customerPhone) && !showCustomerDetails && (
                <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 600 }}>· {customerName || customerPhone}</span>
              )}
            </span>
            <span style={{ fontSize: '11px', color: '#94A3B8', transform: showCustomerDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {showCustomerDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '10px' }}>
              <input type="text" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              <input type="tel" placeholder="Mobile Number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              {loyaltyEnabled && customerPhone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#F5F3FF', borderRadius: '6px', border: '1px solid #C7D2FE' }}>
                  <span style={{ fontSize: '11px' }}>⭐</span>
                  <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: '600' }}>
                    {customerLoyaltyPoints > 0 ? `${customerLoyaltyPoints} loyalty pts` : 'No loyalty pts yet'}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="GSTIN (Optional)" value={customerGstin} onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
                  style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
                <input type="text" placeholder="State" value={customerStateCode} onChange={e => setCustomerStateCode(e.target.value)}
                  style={{ width: '72px', flexShrink: 0, padding: '8px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
              </div>
              <input type="text" placeholder="Billing Address (Optional)" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Custom Item Row */}
          <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', alignItems: 'center', marginTop: '10px' }}>
            <input type="text" placeholder="Custom item..." value={customItemName} onChange={e => setCustomItemName(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#0F172A', outline: 'none', fontSize: '13px', padding: '4px 0' }} />
            <input type="number" placeholder="₹" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)}
              style={{ width: '60px', background: 'transparent', border: 'none', color: '#D97706', outline: 'none', fontSize: '13px', fontWeight: 'bold', padding: '4px 0' }} />
            <button onClick={addCustomItem} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Add</button>
          </div>
        </div>

        {/* ── SCROLLABLE MIDDLE: Cart Items — this is the part that needs room ── */}
        <div className="pos-cart-items" style={{ flex: '1 1 auto', minHeight: '120px', overflowY: 'auto', padding: '10px 16px' }}>
          {billItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748B', fontSize: '13px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', minHeight: '160px', justifyContent: 'center' }}>
              <Package size={36} style={{ opacity: 0.2 }} />
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '14px' }}>Cart is Empty</p>
              <p style={{ margin: 0, fontSize: '12px', maxWidth: '220px' }}>Search products, scan a barcode, or add a custom item to get started</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {billItems.map((item, idx) => {
                const hasVariantPricing = Array.isArray(item.variantPrices) && item.variantPrices.length > 0;
                const variantList  = hasVariantPricing
                  ? item.variantPrices.map(v => v.name)
                  : (item.variants ? item.variants.split(',').map(v => v.trim()) : []);
                const itemDisc     = item.itemDiscount || 0;  // % per item
                const baseAmt      = item.price * (item.qty || 1);
                const discAmt      = itemDisc > 0 ? Math.round(baseAmt * itemDisc / 100) : 0;
                const lineTotal    = baseAmt - discAmt;
                const isExpanded   = expandedItemId === (item.id || idx);
                return (
                  <div key={item.id || idx} style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 10px 8px' }}>
                      {/* Row 1: name + variant + delete — delete gets its own clear space, not squeezed at the end of a packed line */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                          {variantList.length > 0 && (
                            <select value={item.selectedVariant || ''} onChange={e => updateBillItemVariant(item.id, e.target.value)}
                              style={{ marginTop: '4px', background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '5px', fontSize: '10px', padding: '2px 5px', outline: 'none' }}>
                              {hasVariantPricing
                                ? item.variantPrices.map((v, vidx) => <option key={vidx} value={v.name}>{v.name} — ₹{v.price}</option>)
                                : variantList.map((v, vidx) => <option key={vidx} value={v}>{v}</option>)}
                            </select>
                          )}
                        </div>
                        <button
                          onClick={() => removeBillItem(item.id)}
                          title="Remove from bill"
                          aria-label={`Remove ${item.name} from bill`}
                          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#EF4444', cursor: 'pointer', padding: '6px', borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, transform 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Row 2: price/discount info on the left, qty stepper + line total on the right — properly spaced, no longer crammed into one strip */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                          {item.originalPrice ? (
                            <>
                              <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>₹{item.price}</span>
                              <span style={{ fontSize: '10px', color: '#94A3B8', textDecoration: 'line-through' }}>₹{item.originalPrice}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 'bold' }}>₹{item.price}</span>
                          )}
                          {itemDisc > 0 && <span style={{ fontSize: '10px', background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>-{itemDisc}%</span>}
                          <button onClick={() => setExpandedItemId(isExpanded ? null : (item.id || idx))} title="Item discount" style={{ background: itemDisc > 0 ? '#EEF2FF' : 'transparent', border: `1px solid ${itemDisc > 0 ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '5px', padding: '3px 5px', cursor: 'pointer', color: '#4F46E5', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <Tag size={11} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '7px', padding: '2px' }}>
                            <button onClick={() => updateBillItemQty(item.id, -1)} style={{ background: '#F1F5F9', border: 'none', color: '#0F172A', width: 24, height: 24, borderRadius: 5, cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '24px', textAlign: 'center', color: '#0F172A' }}>
                              {item.qty || 1}{(() => { const s = UNIT_SUFFIX[resolveUnit(item, shopCategory)]; return s ? <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 'normal', marginLeft: 1 }}>{s}</span> : null; })()}
                            </span>
                            <button onClick={() => updateBillItemQty(item.id, 1)} style={{ background: '#F1F5F9', border: 'none', color: '#0F172A', width: 24, height: 24, borderRadius: 5, cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                          <span style={{ fontWeight: '800', color: '#10B981', minWidth: '48px', textAlign: 'right', fontSize: '13px' }}>₹{lineTotal}</span>
                        </div>
                      </div>
                    </div>
                    {/* Inline item discount */}
                    {isExpanded && (
                      <div style={{ padding: '6px 10px 8px', background: '#EEF2FF', borderTop: '1px solid #C7D2FE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Discount:</span>
                        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                          {[0, 5, 10, 15, 20, 25, 50].map(d => (
                            <button key={d} onClick={() => { updateBillItemDiscount && updateBillItemDiscount(item.id, d); if (d === 0) setExpandedItemId(null); }}
                              style={{ flex: 1, padding: '4px 2px', background: itemDisc === d ? '#4F46E5' : '#fff', color: itemDisc === d ? '#fff' : '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                              {d === 0 ? 'None' : `${d}%`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── PINNED BOTTOM: Discount + Totals + Payment + Buttons ── */}
        <div className="pos-cart-footer" style={{ flexShrink: 0, padding: '12px 16px 16px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '52vh', overflowY: 'auto' }}>

        {/* Bill-level Discount % */}
        <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', flex: 1 }}>Bill Discount %</span>
            {manualDiscountPct > 0 && (
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', padding: '2px 7px' }}>
                -₹{manualDiscountAmt.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            {[0, 5, 10, 15, 20].map(d => (
              <button key={d} onClick={() => setManualDiscountPct && setManualDiscountPct(d)}
                style={{ flex: 1, padding: '8px 4px', background: manualDiscountPct === d ? '#4F46E5' : '#FFFFFF', color: manualDiscountPct === d ? '#FFFFFF' : '#475569', border: `1px solid ${manualDiscountPct === d ? '#4F46E5' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {d}%
              </button>
            ))}
            <div style={{ position: 'relative', width: '60px', flexShrink: 0 }}>
              <input type="number" min="0" max="99" value={manualDiscountPct || ''} onChange={e => setManualDiscountPct && setManualDiscountPct(parseFloat(e.target.value) || 0)}
                placeholder="—" style={{ width: '100%', padding: '8px 20px 8px 8px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#64748B', pointerEvents: 'none' }}>%</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
          {(discountAmount > 0 || manualDiscountAmt > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              <span>Discount:</span>
              <span>-₹{(discountAmount + manualDiscountAmt).toLocaleString('en-IN')}</span>
            </div>
          )}
          {loyaltyEnabled && customerLoyaltyPoints > 0 && (
            <div style={{ background: '#F5F3FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#4F46E5' }}>⭐ Loyalty Points</span>
                <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '700' }}>{customerLoyaltyPoints} pts</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="range" min={0} max={maxRedeemable} step={10} value={loyaltyRedeem} onChange={e => setLoyaltyRedeem && setLoyaltyRedeem(parseInt(e.target.value))} style={{ flex: 1, accentColor: '#4F46E5' }} />
                <span style={{ fontSize: '11px', color: '#6366F1', minWidth: '50px', textAlign: 'right' }}>{loyaltyRedeem} pts</span>
              </div>
              {loyaltyDiscountRupees > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4F46E5', fontWeight: '600' }}>
                  <span>Points Redeemed:</span><span>-₹{loyaltyDiscountRupees}</span>
                </div>
              )}
              <p style={{ margin: 0, fontSize: '9px', color: '#4F46E5' }}>10 pts = ₹1 off • Slide to redeem</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Subtotal</span>
            <span style={{ fontSize: '13px', color: (discountAmount > 0 || manualDiscountAmt > 0 || loyaltyDiscountRupees > 0) ? '#94A3B8' : '#0F172A', textDecoration: (discountAmount > 0 || manualDiscountAmt > 0 || loyaltyDiscountRupees > 0) ? 'line-through' : 'none' }}>₹{billTotal}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: '10px', padding: '10px 14px' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#D97706' }}>Final Payable</span>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#D97706', letterSpacing: '-0.02em' }}>₹{finalTotal}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {PAY_METHODS.map(({ key, icon, color }) => (
              <button key={key}
                onClick={() => { setPaymentMethod && setPaymentMethod(key); if (key === 'UPI') handleShowUpiQr(); }}
                style={{ padding: '10px 6px', borderRadius: '10px', border: paymentMethod === key ? `2px solid ${color}` : '1px solid #E2E8F0', background: paymentMethod === key ? `${color}14` : '#FFFFFF', color: paymentMethod === key ? color : '#475569', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
                <span>{key}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Confirm Bill Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={sendWhatsAppBill} disabled={billItems.length === 0}
            style={{ background: billingMode === 'estimate' ? 'linear-gradient(135deg,#D97706,#B45309)' : billingMode === 'challan' ? 'linear-gradient(135deg,#4F46E5,#4338CA)' : 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', opacity: billItems.length ? 1 : 0.5, width: '100%', padding: '13px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: billItems.length ? 'pointer' : 'not-allowed', boxShadow: billItems.length ? '0 4px 15px rgba(34,197,94,0.25)' : 'none', transition: 'all 0.2s' }}>
            <Share2 size={16} />
            {billingMode === 'estimate' ? (canShare ? '✓ Generate & Share Estimate' : '✓ Download Estimate PDF')
              : billingMode === 'challan' ? (canShare ? '✓ Generate & Share Challan' : '✓ Download Challan PDF')
              : '✓ Confirm & Generate Bill'}
          </button>
          <button onClick={handleShowUpiQr} style={{ width: '100%', background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.25)', padding: '10px', borderRadius: '10px', fontWeight: '600', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <QrCode size={14} /> 📲 Show UPI QR to Customer
          </button>
        </div>
        </div>
      </div>

      {/* ── Barcode Scan Popup ── */}
      {scanPopupProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onScanPopupClose}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '28px', maxWidth: '380px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✅ Barcode Matched
              </div>
              <button onClick={onScanPopupClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>

            {(scanPopupProduct.image || (scanPopupProduct.images && scanPopupProduct.images[0])) && (
              <img src={scanPopupProduct.image || scanPopupProduct.images[0]} alt={scanPopupProduct.name} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px', border: '1px solid #E2E8F0' }} />
            )}

            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>{scanPopupProduct.name}</h2>

            {scanPopupProduct.variants && (
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748B' }}>Variants: {scanPopupProduct.variants}</p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '16px 0' }}>
              <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Price</p>
                {(() => {
                  const sale = flashSales[scanPopupProduct.id];
                  const activeSale = sale && new Date(sale.expiresAt) > new Date();
                  const standingDiscPct = Math.min(99, Number(scanPopupProduct.discountPct) || 0);
                  const salePrice = activeSale
                    ? Math.max(0, Math.round(scanPopupProduct.price * (1 - sale.discount / 100)))
                    : standingDiscPct > 0
                      ? Math.max(0, Math.round(scanPopupProduct.price * (1 - standingDiscPct / 100)))
                      : null;
                  return activeSale ? (
                    <div>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#EF4444' }}>₹{salePrice}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', textDecoration: 'line-through' }}>₹{scanPopupProduct.price}</p>
                      <span style={{ fontSize: '10px', background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>🔥 {sale.discount}% OFF</span>
                    </div>
                  ) : standingDiscPct > 0 ? (
                    <div>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#EF4444' }}>₹{salePrice}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', textDecoration: 'line-through' }}>₹{scanPopupProduct.price}</p>
                      <span style={{ fontSize: '10px', background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>🏷️ {standingDiscPct}% OFF</span>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#4F46E5' }}>₹{scanPopupProduct.price}</p>
                  );
                })()}
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Stock</p>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: (scanPopupProduct.stock || 0) <= 0 ? '#EF4444' : (scanPopupProduct.stock < (scanPopupProduct.reorderLevel || 10)) ? '#F59E0B' : '#10B981' }}>
                  {scanPopupProduct.stock || 0}
                </p>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748B' }}>{(scanPopupProduct.stock || 0) <= 0 ? 'Out of stock' : (scanPopupProduct.stock < (scanPopupProduct.reorderLevel || 10)) ? '⚠️ Low stock' : 'In stock'}</p>
              </div>
              {scanPopupProduct.batchNumber && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Batch</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{scanPopupProduct.batchNumber}</p>
                </div>
              )}
              {scanPopupProduct.expiryDate && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Expiry</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: new Date(scanPopupProduct.expiryDate) < new Date() ? '#EF4444' : '#0F172A' }}>{scanPopupProduct.expiryDate}</p>
                </div>
              )}
              {scanPopupProduct.hsnCode && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>HSN Code</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{scanPopupProduct.hsnCode}</p>
                </div>
              )}
              {scanPopupProduct.gstRate !== undefined && scanPopupProduct.gstRate > 0 && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>GST</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{scanPopupProduct.gstRate}%</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onScanPopupClose} style={{ flex: 1, padding: '12px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
                Cancel
              </button>
              <button
                onClick={() => { onScanPopupAdd && onScanPopupAdd(scanPopupProduct); }}
                disabled={(scanPopupProduct.stock || 0) <= 0}
                style={{ flex: 2, padding: '12px', background: (scanPopupProduct.stock || 0) <= 0 ? '#CBD5E1' : 'linear-gradient(135deg,#4F46E5,#4338CA)', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: (scanPopupProduct.stock || 0) <= 0 ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                + Add to Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopPOS;
