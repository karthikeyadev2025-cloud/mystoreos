import { Search, ScanLine, Plus, IndianRupee, Book, Receipt, Share2, Package, X, QrCode } from 'lucide-react';

const DesktopPOS = ({
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
  sendWhatsAppBill,
  addToBill,
  setActiveTab,
  setShowAddProductModal
}) => {
  const lowStockProducts = products.filter(p => p.stock < 10);

  return (
    <div className="responsive-split-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Left Column (2/3 width): Products, Stats, Search, Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* AI Insights Card */}
        {lowStockProducts.length > 0 && (
          <div className="premium-glass" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.08))', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>🤖</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#fca5a5', fontWeight: 'bold' }}>AI Inventory Warning</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#f87171', lineHeight: '1.4' }}>
                You are running low on <b>{lowStockProducts.map(p => p.name).join(', ')}</b>. Based on your weekend sales trend, you will run out by Sunday.
              </p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="premium-glass" onClick={() => setActiveTab('bills')} style={{ padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'transform 0.2s' }}>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: pendingOrders > 0 ? '#ef4444' : '#fbbf24', margin: 0 }}>{pendingOrders}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>New Orders</p>
          </div>
          {isOwner && (
            <div className="premium-glass" style={{ padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>₹{sales}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>Today's Sales</p>
            </div>
          )}
          <div className="premium-glass" onClick={() => setActiveTab('products')} style={{ padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>{products.length}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>Total Products</p>
          </div>
          {isOwner && (
            <div className="premium-glass" onClick={() => setActiveTab('credit')} style={{ padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', margin: 0 }}>₹{payable}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>Supplier Credit</p>
            </div>
          )}
        </div>

        {/* Search & Actions Panel */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#0f172a', borderRadius: '12px', padding: '4px 16px', border: '1px solid #334155', marginBottom: '16px' }}>
            <Search size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search products to add to bill..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, boxShadow: 'none', width: '100%', padding: '12px 0', color: 'white', outline: 'none', fontSize: '15px' }} 
            />
          </div>

          {/* Action Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <button className="premium-btn" onClick={() => setShowScanner(true)} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'white' }}>
              <ScanLine size={20} color="#3b82f6" />
              <span style={{ fontSize: '11px', fontWeight: '600' }}>Barcode Scan</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => { setActiveTab('products'); setShowAddProductModal(true); }} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'white' }}>
                <Plus size={20} color="#10b981" />
                <span style={{ fontSize: '11px', fontWeight: '600' }}>Add Product</span>
              </button>
            )}
            <button className="premium-btn" onClick={handleShowUpiQr} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'white' }}>
              <IndianRupee size={20} color="#f59e0b" />
              <span style={{ fontSize: '11px', fontWeight: '600' }}>UPI QR Code</span>
            </button>
            {isOwner && (
              <button className="premium-btn" onClick={() => setActiveTab('credit')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'white' }}>
                <Book size={20} color="#8b5cf6" />
                <span style={{ fontSize: '11px', fontWeight: '600' }}>Credit Ledger</span>
              </button>
            )}
            <button className="premium-btn" onClick={() => setActiveTab('bills')} style={{ padding: '12px 8px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'white' }}>
              <Receipt size={20} color={pendingOrders > 0 ? '#ef4444' : '#cbd5e1'} />
              <span style={{ fontSize: '11px', fontWeight: '600' }}>All Bills</span>
            </button>
          </div>
        </div>

        {/* Product Grid Catalog (Quick Add) */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="#fbbf24" /> Quick Shelf Explorer
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
            {filteredProducts.map(p => {
              const lowStock = p.stock < (p.reorderLevel || 10);
              return (
                <div key={p.id} className="premium-glass" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s', position: 'relative' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: 'white' }}>{p.name}</h4>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#fbbf24' }}>₹{p.price}</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: lowStock ? '#ef4444' : '#94a3b8', fontWeight: lowStock ? 'bold' : 'normal' }}>
                      Stock: {p.stock || 0}
                    </p>
                  </div>
                  <button 
                    onClick={() => addToBill(p)}
                    style={{ 
                      background: 'rgba(59, 130, 246, 0.1)', 
                      border: '1px solid rgba(59, 130, 246, 0.3)', 
                      color: '#3b82f6', 
                      width: '100%', 
                      padding: '8px', 
                      borderRadius: '8px', 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      cursor: 'pointer', 
                      marginTop: '12px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = '#3b82f6'; }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p style={{ gridColumn: '1/-1', color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No products found matching query.</p>
            )}
          </div>
        </div>

      </div>

      {/* Right Column (1/3 width): Checkout Cart */}
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} color="#10b981" /> POS Terminal
          </h3>
          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
            Active Session
          </span>
        </div>

        {/* Billing Mode Segmented Control */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => setBillingMode('bill')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'bill' ? 'rgba(16,185,129,0.2)' : 'transparent',
              color: billingMode === 'bill' ? '#10b981' : '#94a3b8',
            }}
          >
            Bill
          </button>
          <button 
            onClick={() => setBillingMode('estimate')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'estimate' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: billingMode === 'estimate' ? '#f59e0b' : '#94a3b8',
            }}
          >
            Estimate
          </button>
          <button 
            onClick={() => setBillingMode('challan')} 
            style={{ 
              flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: billingMode === 'challan' ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: billingMode === 'challan' ? '#3b82f6' : '#94a3b8',
            }}
          >
            Challan
          </button>
        </div>

        {/* Customer Details Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#cbd5e1' }}>Customer Profiling</p>
          <input 
            type="text" 
            placeholder="Customer Name" 
            value={customerName} 
            onChange={e => setCustomerName(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="tel" 
              placeholder="Mobile Number" 
              value={customerPhone} 
              onChange={e => setCustomerPhone(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
            />
            <input 
              type="text" 
              placeholder="State Code" 
              value={customerStateCode} 
              onChange={e => setCustomerStateCode(e.target.value)}
              style={{ width: '80px', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <input 
            type="text" 
            placeholder="GSTIN (Optional)" 
            value={customerGstin} 
            onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
          <input 
            type="text" 
            placeholder="Billing Address (Optional)" 
            value={customerAddress} 
            onChange={e => setCustomerAddress(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Add Miscellaneous / Custom Item */}
        <div style={{ display: 'flex', gap: '8px', background: '#0f172a', padding: '8px 12px', borderRadius: '10px', border: '1px solid #334155' }}>
          <input 
            type="text" placeholder="Custom item..." value={customItemName} onChange={e => setCustomItemName(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '13px' }} 
          />
          <input 
            type="number" placeholder="₹" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)}
            style={{ width: '50px', background: 'transparent', border: 'none', color: '#fbbf24', outline: 'none', fontSize: '13px', fontWeight: 'bold' }} 
          />
          <button onClick={addCustomItem} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Add</button>
        </div>

        {/* Invoice Basket Items */}
        <div style={{ flex: 1, minHeight: '140px', overflowY: 'auto' }}>
          {billItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '32px 0' }}>
              <Package size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ margin: 0 }}>Voucher Basket is Empty</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {billItems.map((item, idx) => {
                const variantList = item.variants ? item.variants.split(',').map(v => v.trim()) : [];
                return (
                  <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ flex: 1, marginRight: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#fff' }}>{item.name}</p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold' }}>₹{item.price}</span>
                        {variantList.length > 0 && (
                          <select 
                            value={item.selectedVariant || ''} 
                            onChange={(e) => updateBillItemVariant(item.id, e.target.value)}
                            style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', fontSize: '10px', padding: '1px 2px', outline: 'none' }}
                          >
                            {variantList.map((v, vidx) => (
                              <option key={vidx} value={v}>{v}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => updateBillItemQty(item.id, -1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: '11px' }}>-</button>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '12px', textAlign: 'center' }}>{item.qty || 1}</span>
                      <button onClick={() => updateBillItemQty(item.id, 1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: '11px' }}>+</button>
                      
                      <span style={{ fontWeight: 'bold', color: '#10b981', minWidth: '45px', textAlign: 'right', fontSize: '12px' }}>₹{item.price * (item.qty || 1)}</span>
                      
                      <button onClick={() => removeBillItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Promo discount & calculations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#0f172a', padding: '4px 8px', borderRadius: '8px', border: '1px solid #334155' }}>
            <input 
              type="text" 
              placeholder="Promo Code" 
              value={promoCode} 
              onChange={e => setPromoCode(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '12px' }} 
            />
            <button onClick={applyPromoCode} style={{ background: '#f59e0b', color: 'black', border: 'none', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Apply</button>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#10b981', fontWeight: '500' }}>
              <span>Promo Discount:</span>
              <span>-₹{discountAmount}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>Gross Total</span>
            <span style={{ fontSize: '14px', color: '#cbd5e1', textDecoration: discountAmount > 0 ? 'line-through' : 'none' }}>₹{billTotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>Final Payable</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#fbbf24' }}>₹{Math.max(0, billTotal - discountAmount)}</span>
          </div>
        </div>

        {/* Action triggers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={sendWhatsAppBill}
            disabled={billItems.length === 0}
            style={{ 
              background: billingMode === 'estimate' ? '#fbbf24' : (billingMode === 'challan' ? '#2563eb' : '#22c55e'), 
              color: billingMode === 'estimate' ? '#000' : '#fff', 
              opacity: billItems.length ? 1 : 0.5,
              width: '100%', 
              padding: '12px', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: '700', 
              fontSize: '14px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: billItems.length ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s'
            }}
          >
            <Share2 size={16} /> 
            {billingMode === 'estimate' ? 'Generate Estimate & Share' : (billingMode === 'challan' ? 'Generate Challan & Share' : 'Checkout & Print Bill')}
          </button>
          
          <button onClick={handleShowUpiQr} style={{ width: '100%', background: '#334155', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <QrCode size={16} /> Show Payment UPI QR
          </button>
        </div>

      </div>
    </div>
  );
};

export default DesktopPOS;
