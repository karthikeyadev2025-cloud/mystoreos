import { Truck, ShoppingCart, ShieldAlert, Plus, Check } from 'lucide-react';

const DesktopRestock = ({
  products,
  wholesaleCatalog,
  restockCart,
  handleRestockQtyChange,
  handlePlaceRestockOrder
}) => {
  const lowStockList = products.filter(p => p.stock < 10);
  const cartItemCount = Object.keys(restockCart).length;

  const basketTotal = Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
    const prod = wholesaleCatalog.find(p => p.id === prodId);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: FMCG Wholesale Catalog */}
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={22} color="#3b82f6" /> Supply & FMCG Wholesale Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Purchase fresh FMCG stocks directly from connected distributors at wholesale trade prices.
          </p>
        </div>

        {wholesaleCatalog.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '36px 0' }}>
            No active wholesale distributors available currently.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {wholesaleCatalog.map(p => {
              const inCartQty = restockCart[p.id] || 0;
              return (
                <div key={p.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '9px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {p.category}
                    </span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: 'white', fontWeight: '700' }}>{p.name}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Trade Price: <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{p.price}</span></p>
                  </div>
                  
                  <button 
                    onClick={() => handleRestockQtyChange(p.id, 1)} 
                    style={{ 
                      background: inCartQty > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
                      border: inCartQty > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.2)', 
                      color: inCartQty > 0 ? '#10b981' : '#3b82f6', 
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
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} color="#10b981" /> Supply Cart
            </h3>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
              {cartItemCount} SKUs
            </span>
          </div>

          {cartItemCount === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '24px 0', margin: 0 }}>
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
                        <span style={{ color: '#fff', fontWeight: 'bold', display: 'block' }}>{prod.name}</span>
                        <span style={{ color: '#94a3b8', fontSize: '10px' }}>₹{prod.price} / unit</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#10b981', marginRight: '6px' }}>₹{prod.price * qty}</span>
                        <button onClick={() => handleRestockQtyChange(prodId, -1)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                        <span style={{ fontWeight: 'bold', minWidth: '14px', textAlign: 'center', color: '#fff' }}>{qty}</span>
                        <button onClick={() => handleRestockQtyChange(prodId, 1)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#94a3b8' }}>Total Payable</span>
                <span style={{ fontWeight: '800', fontSize: '20px', color: '#fbbf24' }}>₹{basketTotal}</span>
              </div>

              <button 
                onClick={handlePlaceRestockOrder} 
                style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', textAlign: 'center' }}
              >
                Place Restock Supply Order
              </button>
            </>
          )}
        </div>

        {/* Low Stock Warning Card */}
        {lowStockList.length > 0 && (
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.2)', background: 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(220,38,38,0.02))' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#ef4444', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} /> Critical Replenishments
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowStockList.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#cbd5e1' }}>{p.name}</span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{p.stock} units left!</span>
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
