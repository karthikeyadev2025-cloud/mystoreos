import { useState } from 'react';
import { Search, ScanLine, Plus, IndianRupee, Book, Receipt, Share2, Package, X, QrCode } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { resolveUnit, UNIT_SUFFIX } from '../lib/units';

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
  promoCode,
  setPromoCode,
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
  applyPromoCode,
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
}) => {
  const { hasFeature } = useSubscription();
  const canShare = hasFeature('whatsappShare');
  const [targetInput, setTargetInput] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);
  const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10);
  const maxRedeemable = Math.floor(customerLoyaltyPoints / 10) * 10;

  const CIRC = 2 * Math.PI * 28;
  const targetPct = dailyTarget > 0 ? Math.min(1, sales / dailyTarget) : 0;
  const ringOffset = CIRC * (1 - targetPct);
  const targetPctInt = Math.round(targetPct * 100);
  const ringColor = targetPctInt >= 100 ? '#10B981' : targetPctInt >= 60 ? '#F59E0B' : '#EF4444';
  const motivation = targetPctInt >= 100 ? '🎉 Target Hit!' : targetPctInt >= 80 ? '💪 Almost There!' : targetPctInt >= 50 ? '📈 Keep Going!' : '🚀 Start Billing!';
  const lowStockProducts = products.filter(p => p.stock < (p.reorderLevel || 10));

  return (
    <div className="responsive-split-grid" style={{ alignItems: 'start' }}>
      {/* Left Column (2/3 width): Products, Stats, Search, Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* AI Insights Card */}
        {lowStockProducts.length > 0 && (
          <div className="premium-glass" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>🤖</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#991B1B', fontWeight: 'bold' }}>AI Inventory Warning</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#7F1D1D', lineHeight: '1.4' }}>
                You are running low on <b>{lowStockProducts.map(p => p.name).join(', ')}</b>. Based on your weekend sales trend, you will run out by Sunday.
              </p>
            </div>
          </div>
        )}

        {/* KPI Row — Zoho-style: left-aligned, small grey label, bold dark number */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('bills')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
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
          <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('products')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Total Products</p>
            <p style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>{products.length}</p>
          </div>
          {isOwner && (
            <div className="premium-glass ds-card-interactive" onClick={() => setActiveTab('credit')} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Supplier Credit</p>
              <p style={{ fontSize: '26px', fontWeight: '800', color: payable > 0 ? '#EF4444' : '#0F172A', margin: '8px 0 0 0', letterSpacing: '-0.02em' }}>₹{payable}</p>
            </div>
          )}
        </div>

        {/* Daily Target Progress Ring */}
        {isOwner && (
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            {dailyTarget > 0 ? (
              <>
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                  <circle cx="40" cy="40" r="28" fill="none" stroke={ringColor} strokeWidth="7"
                    strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                    strokeLinecap="round" transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  <text x="40" y="45" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="bold" fontFamily="Plus Jakarta Sans, sans-serif">{targetPctInt}%</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '2px' }}>{motivation}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>₹{sales.toLocaleString('en-IN')} of ₹{dailyTarget.toLocaleString('en-IN')} daily target</div>
                  <button onClick={() => setShowTargetInput(v => !v)} style={{ fontSize: '10px', color: '#4F46E5', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Change Target
                  </button>
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
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  style={{ width: '90px', padding: '6px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }}
                />
                <button
                  onClick={() => { handleSetDailyTarget && handleSetDailyTarget(targetInput); setTargetInput(''); setShowTargetInput(false); }}
                  style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Set
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search & Actions Panel */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#F1F5F9', borderRadius: '10px', padding: '4px 16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
            <Search size={16} color="#64748B" />
            <input 
              type="text" 
              placeholder="Search products to add to bill..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, boxShadow: 'none', color: '#0F172A', width: '100%', padding: '12px 0', outline: 'none', fontSize: '15px' }} 
            />
          </div>

          {/* Action Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <button className="premium-btn" onClick={() => setShowScanner(true)} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', color: '#0F172A', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <ScanLine size={20} color="#4F46E5" />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Barcode Scan</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => { setActiveTab('products'); setShowAddProductModal(true); }} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', color: '#0F172A', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <Plus size={20} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Add Product</span>
              </button>
            )}
            <button className="premium-btn" onClick={handleShowUpiQr} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', color: '#0F172A', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <IndianRupee size={20} color="#D97706" />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>UPI QR Code</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => setActiveTab('credit')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', color: '#0F172A', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <Book size={20} color="#6366F1" />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Credit Ledger</span>
              </button>
            )}
            <button className="premium-btn" onClick={() => setActiveTab('bills')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: '#FFFFFF', cursor: 'pointer', color: '#0F172A', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <Receipt size={20} color={pendingOrders > 0 ? '#EF4444' : '#64748B'} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>All Bills</span>
            </button>
          </div>
        </div>

        {/* Product Grid Catalog (Quick Add) */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="#D97706" /> Quick Shelf Explorer
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', alignContent: 'start' }}>
            {filteredProducts.map(p => {
              const lowStock = p.stock < (p.reorderLevel || 10);
              const sale = flashSales[p.id];
              const activeSale = sale && new Date(sale.expiresAt) > new Date();
              const salePrice = activeSale ? Math.round(p.price * (1 - sale.discount / 100)) : null;
              const minsLeft = activeSale ? Math.max(0, Math.round((new Date(sale.expiresAt) - new Date()) / 60000)) : 0;
              const timeLabel = minsLeft >= 60 ? `${Math.floor(minsLeft / 60)}h left` : `${minsLeft}m left`;
              return (
                <div key={p.id} className="premium-glass" style={{ padding: '16px', borderRadius: '16px', background: activeSale ? '#FEF2F2' : '#FFFFFF', border: `1px solid ${activeSale ? '#FCA5A5' : '#E2E8F0'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s', position: 'relative', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  {activeSale && (
                    <div style={{ position: 'absolute', top: '-8px', right: '10px', background: '#EF4444', color: 'white', fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '8px' }}>
                      🔥 -{sale.discount}% · {timeLabel}
                    </div>
                  )}
                  <div>
                    {p.image && (
                      <img src={p.image} alt={p.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E2E8F0' }} />
                    )}
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{p.name}</h4>
                    {activeSale ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#EF4444' }}>₹{salePrice}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748B', textDecoration: 'line-through' }}>₹{p.price}</p>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#4F46E5' }}>₹{p.price}</p>
                    )}
                    <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: lowStock ? '#EF4444' : '#64748B', fontWeight: lowStock ? 'bold' : 'normal' }}>
                      Stock: {p.stock || 0}
                    </p>
                  </div>
                  <button 
                    onClick={() => addToBill(p)}
                    style={{ 
                      background: 'rgba(79, 70, 229, 0.08)', 
                      border: '1px solid rgba(79, 70, 229, 0.25)', 
                      color: '#4F46E5', 
                      width: '100%', 
                      padding: '8px', 
                      borderRadius: '8px', 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      cursor: 'pointer', 
                      marginTop: '12px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#4F46E5'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79, 70, 229, 0.08)'; e.currentTarget.style.color = '#4F46E5'; }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 16px', color: '#64748B' }}>
                <Package size={40} style={{ opacity: 0.2 }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#64748B' }}>No products found</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Try a different search, or add your first product</p>
              </div>
            )}
          </div>
        </div>
        {footerSlot}

      </div>

      {/* Right Column (1/3 width): Checkout Cart */}
      <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} color="#10B981" /> POS Terminal
          </h3>
          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10B981', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
            Active Session
          </span>
        </div>

        {/* Billing Mode Segmented Control */}
        <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '4px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <button 
            onClick={() => setBillingMode('bill')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'bill' ? 'rgba(16,185,129,0.2)' : 'transparent',
              color: billingMode === 'bill' ? '#10B981' : '#64748B',
            }}
          >
            Bill
          </button>
          <button 
            onClick={() => setBillingMode('estimate')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'estimate' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: billingMode === 'estimate' ? '#D97706' : '#64748B',
            }}
          >
            Estimate
          </button>
          <button 
            onClick={() => setBillingMode('challan')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'challan' ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: billingMode === 'challan' ? '#3B82F6' : '#64748B',
            }}
          >
            Challan
          </button>
        </div>

        {/* Customer Details Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Customer Profiling</p>
          <input 
            type="text" 
            placeholder="Customer Name" 
            value={customerName} 
            onChange={e => setCustomerName(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }}
          />
          <input 
            type="tel" 
            placeholder="Mobile Number" 
            value={customerPhone} 
            onChange={e => setCustomerPhone(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', margin: 0 }}
          />
          {loyaltyEnabled && customerPhone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#F5F3FF', borderRadius: '6px', border: '1px solid #C7D2FE' }}>
              <span style={{ fontSize: '11px' }}>⭐</span>
              <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: '600' }}>
                {customerLoyaltyPoints > 0 ? `${customerLoyaltyPoints} loyalty pts` : 'No loyalty pts yet'}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="GSTIN (Optional)"
              value={customerGstin}
              onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', margin: 0 }}
            />
            <input 
              type="text" 
              placeholder="State" 
              value={customerStateCode} 
              onChange={e => setCustomerStateCode(e.target.value)}
              style={{ width: '72px', flexShrink: 0, padding: '8px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', margin: 0 }}
            />
          </div>
          <input 
            type="text" 
            placeholder="Billing Address (Optional)" 
            value={customerAddress} 
            onChange={e => setCustomerAddress(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Add Miscellaneous / Custom Item */}
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
          <input 
            type="text" placeholder="Custom item..." value={customItemName} onChange={e => setCustomItemName(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#0F172A', outline: 'none', fontSize: '13px', margin: 0, padding: '4px 0', width: 'auto' }} 
          />
          <input 
            type="number" placeholder="₹" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)}
            style={{ width: '60px', background: 'transparent', border: 'none', color: '#D97706', outline: 'none', fontSize: '13px', fontWeight: 'bold', margin: 0, padding: '4px 0' }} 
          />
          <button onClick={addCustomItem} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', width: 'auto', margin: 0 }}>Add</button>
        </div>

        {/* Invoice Basket Items */}
        <div style={{ flex: 1, minHeight: '140px', overflowY: 'auto' }}>
          {billItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748B', fontSize: '13px', padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', minHeight: '140px', justifyContent: 'center' }}>
              <Package size={48} style={{ opacity: 0.2, color: '#64748B' }} />
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#64748B', fontSize: '13px' }}>Cart is Empty</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Search products or add a custom item above</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {billItems.map((item, idx) => {
                const variantList = item.variants ? item.variants.split(',').map(v => v.trim()) : [];
                return (
                  <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ flex: 1, marginRight: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#0F172A' }}>{item.name}</p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 'bold' }}>₹{item.price}</span>
                        {variantList.length > 0 && (
                          <select 
                             value={item.selectedVariant || ''} 
                             onChange={(e) => updateBillItemVariant(item.id, e.target.value)}
                             style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '4px', fontSize: '10px', padding: '1px 2px', outline: 'none' }}
                          >
                            {variantList.map((v, vidx) => (
                              <option key={vidx} value={v}>{v}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => updateBillItemQty(item.id, -1)} style={{ background: '#E2E8F0', border: 'none', color: '#0F172A', width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>-</button>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '12px', textAlign: 'center', color: '#0F172A' }}>
                        {item.qty || 1}
                        {(() => { const s = UNIT_SUFFIX[resolveUnit(item, shopCategory)]; return s ? <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 'normal', marginLeft: 2 }}>{s}</span> : null; })()}
                      </span>
                      <button onClick={() => updateBillItemQty(item.id, 1)} style={{ background: '#E2E8F0', border: 'none', color: '#0F172A', width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+</button>
                      
                      <span style={{ fontWeight: 'bold', color: '#10B981', minWidth: '45px', textAlign: 'right', fontSize: '12px' }}>₹{item.price * (item.qty || 1)}</span>
                      
                      <button onClick={() => removeBillItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Manual Discount (% entry) ── */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', flex: 1 }}>Discount %</span>
            {manualDiscountPct > 0 && (
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', padding: '2px 7px' }}>
                -₹{manualDiscountAmt.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Quick preset buttons */}
            {[0, 5, 10, 15, 20].map(d => (
              <button
                key={d}
                onClick={() => setManualDiscountPct && setManualDiscountPct(d)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  background: manualDiscountPct === d ? '#4F46E5' : '#FFFFFF',
                  color: manualDiscountPct === d ? '#FFFFFF' : '#475569',
                  border: `1px solid ${manualDiscountPct === d ? '#4F46E5' : '#E2E8F0'}`,
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {d}%
              </button>
            ))}
            {/* Manual input */}
            <div style={{ position: 'relative', flexShrink: 0, width: '68px' }}>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={manualDiscountPct === 0 ? '' : String(manualDiscountPct)}
                onChange={e => {
                  const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                  setManualDiscountPct && setManualDiscountPct(v);
                }}
                style={{
                  width: '100%',
                  padding: '7px 22px 7px 8px',
                  background: '#FFFFFF',
                  border: `1.5px solid ${manualDiscountPct > 0 && ![0, 5, 10, 15, 20].includes(manualDiscountPct)
                    ? '#4F46E5' : '#E2E8F0'}`,
                  borderRadius: '7px',
                  color: '#0F172A',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'right',
                }}
              />
              <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#64748B', fontWeight: '600', pointerEvents: 'none' }}>%</span>
            </div>
          </div>
        </div>

        {/* Promo discount & calculations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <div className="promo-code-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F1F5F9', padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
            <input 
              type="text" 
              placeholder="Promo / Coupon Code" 
              value={promoCode} 
              onChange={e => setPromoCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyPromoCode()}
              style={{ flex: 1, background: 'transparent', border: 'none !important', boxShadow: 'none', color: '#0F172A', outline: 'none', fontSize: '13px', minWidth: 0, caretColor: '#4F46E5', padding: '4px 0', margin: 0 }} 
            />
            <button onClick={applyPromoCode} style={{ background: '#D97706', color: '#FFFFFF', border: 'none', padding: '5px 12px', borderRadius: '6px', fontWeight: '800', fontSize: '11px', cursor: 'pointer', width: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>Apply</button>
          </div>

          {(discountAmount > 0 || manualDiscountAmt > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              <span>Discount:</span>
              <span>-₹{(discountAmount + manualDiscountAmt).toLocaleString('en-IN')}</span>
            </div>
          )}

          {loyaltyEnabled && customerLoyaltyPoints > 0 && (
            <div style={{ background: '#F5F3FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⭐ Loyalty Points
                </span>
                <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '700' }}>{customerLoyaltyPoints} pts available</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="range"
                  min={0}
                  max={maxRedeemable}
                  step={10}
                  value={loyaltyRedeem}
                  onChange={e => setLoyaltyRedeem && setLoyaltyRedeem(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: '#4F46E5' }}
                />
                <span style={{ fontSize: '11px', color: '#6366F1', minWidth: '50px', textAlign: 'right' }}>{loyaltyRedeem} pts</span>
              </div>
              {loyaltyDiscountRupees > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4F46E5', fontWeight: '600' }}>
                  <span>Points Redeemed:</span>
                  <span>-₹{loyaltyDiscountRupees}</span>
                </div>
              )}
              <p style={{ margin: 0, fontSize: '9px', color: '#4F46E5' }}>10 pts = ₹1 off • Slide to redeem</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>Gross Total</span>
            <span style={{ fontSize: '14px', color: '#0F172A', textDecoration: (discountAmount > 0 || manualDiscountAmt > 0 || loyaltyDiscountRupees > 0) ? 'line-through' : 'none' }}>₹{billTotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#D97706' }}>Final Payable</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#D97706' }}>₹{Math.max(0, billTotal - (discountAmount + manualDiscountAmt) - loyaltyDiscountRupees)}</span>
          </div>
        </div>

        {/* Action triggers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Payment method selector + Confirm */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Payment method quick-select */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
              {['Cash','UPI','Card','Credit'].map(method => (
                <button
                  key={method}
                  onClick={() => method === 'UPI' ? handleShowUpiQr() : undefined}
                  style={{ padding: '7px 4px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: '10px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}
                >
                  {method === 'Cash' ? '💵' : method === 'UPI' ? '📱' : method === 'Card' ? '💳' : '📒'}<br />{method}
                </button>
              ))}
            </div>
            {/* Primary generate bill button */}
            <button
              onClick={sendWhatsAppBill}
              disabled={billItems.length === 0}
              style={{
                background: billingMode === 'estimate' ? '#D97706' : (billingMode === 'challan' ? '#4F46E5' : 'linear-gradient(135deg,#22C55E,#16A34A)'),
                color: '#fff',
                opacity: billItems.length ? 1 : 0.5,
                width: '100%',
                padding: '13px',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                cursor: billItems.length ? 'pointer' : 'not-allowed',
                boxShadow: billItems.length ? '0 4px 15px rgba(34,197,94,0.25)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={16} />
              {billingMode === 'estimate'
                ? (canShare ? '✓ Generate & Share Estimate' : '✓ Download Estimate PDF')
                : (billingMode === 'challan'
                  ? (canShare ? '✓ Generate & Share Challan' : '✓ Download Challan PDF')
                  : '✓ Confirm & Generate Bill')}
            </button>
          </div>
          
          <button onClick={handleShowUpiQr} style={{ width: '100%', background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.25)', padding: '10px', borderRadius: '10px', fontWeight: '600', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <QrCode size={14} /> 📲 Show UPI QR to Customer
          </button>
        </div>

      </div>
    </div>
  );
};

export default DesktopPOS;
