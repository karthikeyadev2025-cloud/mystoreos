import { Truck, ShoppingCart, ShieldAlert, Plus, Check, Package, Clock, Mic } from 'lucide-react';
import VoiceOrderInput from './VoiceOrderInput';

// Matches the same 4-state lookup built on the distributor side —
// kept in sync manually since these are two different dashboards, not
// a shared component, but the states and colours should read the same
// to anyone who works with both sides of this relationship.
const STOCK_ORDER_BADGE = {
  pending:    { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
  accepted:   { bg: '#DCFCE7', color: '#15803D', label: 'Accepted' },
  dispatched: { bg: '#DBEAFE', color: '#1D4ED8', label: '📦 Dispatched' },
  delivered:  { bg: '#D1FAE5', color: '#047857', label: '✅ Delivered' },
  rejected:   { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
};

const DesktopRestock = ({
  products = [],
  wholesaleCatalog = [],
  restockCart = {},
  handleRestockQtyChange,
  handlePlaceRestockOrder,
  stockOrders = [],
  onMarkDelivered,
  onOpenVoiceRecorder,
  onShopVoiceRestockOrder,
}) => {
  const lowStockList = products.filter(p => p.stock < (p.reorderLevel || 10));
  const cartItemCount = Object.keys(restockCart).length;

  const basketTotal = Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
    const prod = wholesaleCatalog.find(p => p.id === prodId);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  return (
    <>
    {/* AI Voice Order Recorder Top Banner for Desktop */}
    <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E1B4B)', border: '2px solid #6366F1', borderRadius: '16px', padding: '20px', marginBottom: '24px', color: '#FFFFFF', boxShadow: '0 8px 25px rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid #818CF8', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', boxShadow: '0 0 20px rgba(129,140,248,0.4)', flexShrink: 0 }}>
          <Mic size={28} />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
            🎙️ AI Voice Stock Order Assistant
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#C7D2FE' }}>
            Speak your full order continuously (e.g. <i>"Chikki 2 jars, Biscuit 10 cases, Red Label Tea 5 boxes"</i>). AI parses products, quantities &amp; pack sizes for re-verification!
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={onOpenVoiceRecorder}
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(16,185,129,0.4)' }}
        >
          🎙️ Record Full AI Voice Order
        </button>
        {onShopVoiceRestockOrder && (
          <VoiceOrderInput onTranscript={onShopVoiceRestockOrder} placeholder="Speak: chikki 2 jars..." />
        )}
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: FMCG Wholesale Catalog */}
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={22} color="#4F46E5" /> Supply & FMCG Wholesale Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            Purchase fresh FMCG stocks directly from connected distributors at wholesale trade prices.
          </p>
        </div>

        {wholesaleCatalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <p style={{ color: '#0F172A', fontSize: '14px', fontWeight: 700, margin: '0 0 6px' }}>No linked distributors yet</p>
            <p style={{ color: '#64748B', fontSize: '13px', margin: 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              You'll only see products from distributors you've connected with — go to <strong>Settings</strong> and enter a distributor's code (they'll share it with you, starts with "DST-") to start ordering.
            </p>
          </div>
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
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Trade Price: <span style={{ color: '#10B981', fontWeight: 'bold' }}>₹{p.price}</span></p>
                  </div>
                  
                  <button 
                    onClick={() => handleRestockQtyChange(p.id, 1)} 
                    style={{ 
                      background: inCartQty > 0 ? '#ECFDF5' : '#EFF6FF', 
                      border: inCartQty > 0 ? '1px solid #A7F3D0' : '1px solid #BFDBFE', 
                      color: inCartQty > 0 ? '#10B981' : '#1D4ED8', 
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
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} color="#10B981" /> Supply Cart
            </h3>
            <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
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
                style={{ width: '100%', background: '#10B981', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', textAlign: 'center' }}
              >
                Place Restock Supply Order
              </button>
            </>
          )}
        </div>

        {/* Low Stock Warning Card */}
        {lowStockList.length > 0 && (
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #FCA5A5', background: '#FEF2F2' }}>
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

    {/* My Stock Orders — was completely missing. stockOrders was being
        loaded and even passed into this component already, but never
        rendered anywhere: a shop could place an order here and then had
        no way in the whole app to see whether it was accepted, when it
        might ship, whether it had been dispatched, or to confirm they'd
        received it. Every one of those events already fires a
        notification, but a toast that appears once is not the same as
        an actual order history. */}
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', marginTop: '24px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={20} color="#4F46E5" /> My Stock Orders
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
          Every order you've placed with a distributor, and where it stands.
        </p>
      </div>

      {stockOrders.length === 0 ? (
        <p style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '28px 0' }}>
          No stock orders placed yet — add items to the cart above to get started.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {stockOrders.map(o => {
            const badge = STOCK_ORDER_BADGE[o.status] || STOCK_ORDER_BADGE.pending;
            return (
              <div key={o.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Order #{(o.id || '').slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: 10, background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                    {new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {(o.items || []).length} item{(o.items || []).length === 1 ? '' : 's'} · ₹{o.total}
                  </div>
                  {o.status === 'accepted' && o.expectedDispatchDate && (
                    <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> Expected dispatch: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                  {o.status === 'dispatched' && o.dispatchedAt && (
                    <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, marginTop: 3 }}>
                      Dispatched {new Date(o.dispatchedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                  {o.status === 'delivered' && o.deliveredAt && (
                    <div style={{ fontSize: 11, color: '#047857', fontWeight: 700, marginTop: 3 }}>
                      Confirmed received {new Date(o.deliveredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                </div>
                {/* The closing action — shop confirms the goods actually
                    arrived, notifying the distributor and completing
                    the loop that started when this order was placed. */}
                {o.status === 'dispatched' && (
                  <button onClick={() => onMarkDelivered?.(o.id)}
                    style={{ background: '#10B981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
                    ✅ Confirm Received
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
};

export default DesktopRestock;
