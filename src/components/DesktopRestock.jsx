import { Truck, ShoppingCart, ShieldAlert, Plus, Check } from 'lucide-react';

const DesktopRestock = ({
  products = [],
  wholesaleCatalog,
  restockCart,
  handleRestockQtyChange,
  handlePlaceRestockOrder
}) => {
  const lowStockList = products.filter(p => p.stock < (p.reorderLevel || 10));
  const cartItemCount = Object.keys(restockCart).length;

  const basketTotal = Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
    const prod = wholesaleCatalog.find(p => p.id === prodId);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: FMCG Wholesale Catalog */}
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={22} color="#4F46E5" /> Supply & FMCG Wholesale Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            Purchase fresh FMCG stocks directly from connected distributors at wholesale trade prices.
          </p>
        </div>

        {wholesaleCatalog.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '36px 0' }}>
            No active wholesale distributors available currently.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {wholesaleCatalog.map(p => {
              const inCartQty = restockCart[p.id] || 0;
              return (
                <div key={p.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '9px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {p.category}
                    </span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#0F172A', fontWeight: '700' }}>{p.name}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Trade Price: <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{p.price}</span></p>
                  </div>
                  
                  <button 
                    onClick={() => handleRestockQtyChange(p.id, 1)} 
                    style={{ 
                      background: inCartQty > 0 ? '#ECFDF5' : '#EFF6FF', 
                      border: inCartQty > 0 ? '1px solid #A7F3D0' : '1px solid #BFDBFE', 
                      color: inCartQty > 0 ? '#10b981' : '#1D4ED8', 
                      width: '100%', 
                      padding: '8px', 
                      borderRadius: '8px', 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer', 
                      marginTop: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {inCartQty > 0 ? <Check size={14} /> : <Plus size={14} />}
                    {inCartQty > 0 ? `Added x${inCartQty}` : 'Add Bulk Case'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Basket & Warnings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Restock Basket */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} color="#10b981" /> Supply Cart
            </h3>
            <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
              {cartItemCount} SKUs
            </span>
          </div>

          {cartItemCount === 0 ? (
            <p style={{ color: '#64748B', fontSize: '12px', textAlign: 'center', padding: '24px 0', margin: 0 }}>
              Your restock supply cart is empty. Add bulk goods from the trade catalog.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(restockCart).map(([prodId, qty]) => {
                  const prod = wholesaleCatalog.find(p => p.id === prodId);
                  if (!prod) return null;
                  return (
                    <div key={prodId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ flex: 1, marginRight: '8px' }}>
                        <span style={{ color: '#0F172A', fontWeight: 'bold', display: 'block' }}>{prod.name}</span>
                        <span style={{ color: '#64748B', fontSize: '10px' }}>₹{prod.price} / unit</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#059669', marginRight: '6px' }}>₹{prod.price * qty}</span>
                        <button onClick={() => handleRestockQtyChange(prodId, -1)} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                        <span style={{ fontWeight: 'bold', minWidth: '14px', textAlign: 'center', color: '#0F172A' }}>{qty}</span>
                        <button onClick={() => handleRestockQtyChange(prodId, 1)} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#64748B' }}>Total Payable</span>
                <span style={{ fontWeight: '800', fontSize: '20px', color: '#0F172A' }}>₹{basketTotal}</span>
              </div>

              <button 
                onClick={handlePlaceRestockOrder} 
                style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', textAlign: 'center' }}
              >
                Place Restock Supply Order
              </button>
            </>
          )}
        </div>

        {/* Low Stock Warning Card */}
        {lowStockList.length > 0 && (
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid #FCA5A5', background: '#FEF2F2' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#991B1B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} /> Critical Replenishments
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowStockList.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#0F172A' }}>{p.name}</span>
                  <span style={{ color: '#DC2626', fontWeight: 'bold' }}>{p.stock} units left!</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      
    </div>
  );
};

export default DesktopRestock;
