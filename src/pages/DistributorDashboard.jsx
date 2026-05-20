import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DistributorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [credits, setCredits] = useState([]);
  const [shops, setShops] = useState([]);
  
  // Stock Orders & Wholesale Catalog states
  const [stockOrders, setStockOrders] = useState([]);
  const [wholesaleProducts, setWholesaleProducts] = useState([]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('general');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // New Credit Form
  const [selectedShop, setSelectedShop] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const getNotifications = () => {
    const list = [];
    
    // 1. New Wholesale Orders from Shopkeepers
    (stockOrders || []).forEach(so => {
      if (so.status === 'pending') {
        list.push({
          id: `wholesale_ord_${so.id}`,
          title: "New Wholesale Order",
          text: `Shop "${so.shopName}" requested restock supplies of ₹${so.total}`,
          type: 'wholesale',
          date: so.date,
          emoji: '⚡'
        });
      }
    });
    
    // 2. Credits Settled by Shopkeepers
    (credits || []).forEach(c => {
      if (c.paid) {
        list.push({
          id: `credit_clear_${c.id}`,
          title: "Credit Payment Cleared",
          text: `Shop "${c.shopName || 'Retailer'}" paid/settled ₹${c.amount} of credit balance!`,
          type: 'credit',
          date: c.date,
          emoji: '🤝'
        });
      } else {
        list.push({
          id: `credit_issued_${c.id}`,
          title: "Credit Outstanding",
          text: `Issued ₹${c.amount} credit ledger to "${c.shopName || 'Retailer'}"`,
          type: 'credit',
          date: c.date,
          emoji: '💸'
        });
      }
    });
    
    // Sort by date descending
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const loadData = useCallback(async () => {
    setCredits(await api.getDistCredits(user.id));
    setShops(await api.getAllShops());
    setStockOrders(await api.getDistributorOrders(user.id));
    setWholesaleProducts(await api.getDistributorProducts());
  }, [user.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGiveCredit = async () => {
    if(!selectedShop || !amount) return toast.error("Select shop and amount");
    await api.addCredit(user.id, selectedShop, desc || 'FMCG Stock Supply', amount);
    toast.success("Credit added to shop successfully!");
    setShowModal(false);
    setSelectedShop('');
    setDesc('');
    setAmount('');
    loadData();
  };

  const markPaid = async (creditId) => {
    await api.markCreditPaid(creditId);
    toast.success("Payment Received & Cleared!");
    loadData();
  };

  const handleAddWholesaleProduct = async () => {
    if (!newProdName || !newProdPrice || !newProdStock) return toast.error("Enter product name, price and stock");
    await api.addDistributorProduct({
      distributorId: user.id,
      name: newProdName,
      price: newProdPrice,
      stock: newProdStock,
      category: newProdCategory
    });
    toast.success("Product published to wholesale catalog!");
    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('');
    setShowCatalogModal(false);
    loadData();
  };

  const handleUpdateStockOrder = async (orderId, status) => {
    await api.updateStockOrderStatus(orderId, status);
    toast.success(`Restock order marked as ${status}!`);
    loadData();
  };

  const totalOutstanding = credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
  const totalReceived = credits.filter(c => c.paid).reduce((a, b) => a + b.amount, 0);
  const pendingCredits = credits.filter(c => !c.paid);

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' }}>
      <ToastContainer theme="dark" position="top-center" />
      
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', padding: '20px 16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e40af' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff' }}>📦 FMCG Distributor</h1>
          <div style={{ fontSize: '12px', color: '#93c5fd' }}>{user.name} • Offline Sync Ready</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '14px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            🔔
            {getNotifications().length > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: '-6px', 
                right: '-6px', 
                background: '#ef4444', 
                color: '#fff', 
                borderRadius: '50%', 
                padding: '2px 6px', 
                fontSize: '10px', 
                fontWeight: 'bold' 
              }}>
                {getNotifications().length}
              </span>
            )}
          </button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      {/* Notifications Drawer Overlay */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: '70px', right: '16px', width: '320px', maxHeight: '450px', background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', zIndex: 1000, padding: '16px', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>🔔 Live Notifications</h3>
            <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}>Close</button>
          </div>
          {getNotifications().length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No recent notifications.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {getNotifications().map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{n.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>{n.title}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: 1.3 }}>{n.text}</p>
                    {n.date && (
                      <span style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        {new Date(n.date).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <>
          <div style={{ padding: '16px' }}>
            <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Total Market Outstanding</p>
              <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#ef4444', margin: '8px 0' }}>₹{totalOutstanding}</h2>
              
              {/* Circular SVG Collection progress gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#1e293b" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      stroke="#22c55e"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) : 0))}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#e2e8f0' }}>
                      {Math.round(totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) * 100 : 0)}%
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Collected</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Total Received</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>₹{totalReceived}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Active Shops</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>{shops.length}</p>
                </div>
              </div>
            </div>

            <button onClick={() => setShowModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', marginBottom: '24px', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}>
              + Supply Stock (Give Credit)
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>Pending Market Collection</h3>
            {pendingCredits.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center' }}>No outstanding balances!</p>}
            
            {pendingCredits.map(c => (
              <div key={c.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', margin: 0, color: '#fff' }}>🏪 {c.shopName}</h4>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>{new Date(c.date).toLocaleDateString()} • {c.desc}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ fontSize: '18px', margin: 0, color: '#ef4444' }}>₹{c.amount}</h4>
                    <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px' }}>Unpaid</span>
                  </div>
                </div>
                <button onClick={() => markPaid(c.id)} style={{ width: '100%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Mark Received Cash
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shops Tab */}
      {activeTab === 'shops' && (
        <div style={{padding: 20}}>
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff'}}>🏪 My Shops</h2>
          {shops.length === 0 ? (
            <p style={{color: '#94a3b8', textAlign: 'center'}}>No shops available.</p>
          ) : (
            shops.map(shop => {
              const shopCredits = credits.filter(c => c.toShopId === shop.id && !c.paid);
              const owed = shopCredits.reduce((a, b) => a + b.amount, 0);
              return (
                <div key={shop.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{shop.name}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{shop.phone}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Owed</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: owed > 0 ? '#ef4444' : '#22c55e' }}>₹{owed}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Stock Orders Tab */}
      {activeTab === 'orders' && (
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>📥 Incoming Restock Orders</h2>
          {stockOrders.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>No stock orders received.</p>
          ) : (
            stockOrders.map(o => (
              <div key={o.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>🏪 {o.shopName}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{new Date(o.date).toLocaleDateString()} {new Date(o.date).toLocaleTimeString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '10px',
                      background: o.status === 'pending' ? 'rgba(245,158,11,0.2)' : o.status === 'accepted' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: o.status === 'pending' ? '#f59e0b' : o.status === 'accepted' ? '#22c55e' : '#ef4444',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      textTransform: 'capitalize'
                    }}>{o.status}</span>
                    <h4 style={{ fontSize: '16px', margin: '4px 0 0 0', color: '#3b82f6' }}>₹{o.total}</h4>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid #334155', borderBottom: '1px solid #334155', padding: '8px 0', margin: '8px 0' }}>
                  {o.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', margin: '4px 0' }}>
                      <span>{item.name}</span>
                      <span>x{item.qty} (₹{item.price * item.qty})</span>
                    </div>
                  ))}
                </div>

                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => handleUpdateStockOrder(o.id, 'accepted')} style={{ flex: 1, background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      Accept & Credit
                    </button>
                    <button onClick={() => handleUpdateStockOrder(o.id, 'rejected')} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff' }}>📦 Wholesale Catalog</h2>
            <button onClick={() => setShowCatalogModal(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              + Add Product
            </button>
          </div>

          {wholesaleProducts.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>No wholesale products published yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {wholesaleProducts.map(p => (
                <div key={p.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '9px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>{p.category}</span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{p.name}</h4>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#22c55e' }}>₹{p.price}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Stock: {p.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{padding: 20}}>
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff'}}>✅ Collection History</h2>
          {credits.filter(c => c.paid).length === 0 ? (
            <p style={{color: '#94a3b8', textAlign: 'center'}}>No history of paid collections.</p>
          ) : (
            credits.filter(c => c.paid).map(c => (
              <div key={c.id} style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{c.shopName}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#22c55e' }}>{c.desc} • {new Date(c.date).toLocaleDateString()}</p>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22c55e' }}>+ ₹{c.amount}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Credit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 20px 0' }}>📦 Supply Stock on Credit</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Select Shop</label>
              <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)} style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
                <option value="">-- Choose Shop --</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Bill Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Description (Optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. 2 Cartons ITC Cigarettes" style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
            </div>

            <button onClick={handleGiveCredit} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Credit Entry</button>
            <button onClick={() => setShowModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Wholesale Product Modal */}
      {showCatalogModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 20px 0' }}>📦 Publish Wholesale Product</h2>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Carton (100 packets)" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Price (₹)</label>
                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="850" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Bulk Stock Qty</label>
                <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="50" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Category</label>
              <select value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
                <option value="biscuits">Biscuits & Snacks</option>
                <option value="flour">Atta & Flours</option>
                <option value="soaps">Soaps & Shampoos</option>
                <option value="oil">Cooking Oils</option>
                <option value="general">General Items</option>
              </select>
            </div>

            <button onClick={handleAddWholesaleProduct} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Publish Product</button>
            <button onClick={() => setShowCatalogModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '10px', borderRadius: '10px', fontSize: '14px', marginTop: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-around', padding: '12px 0', zIndex: 90 }}>
        <div style={{ textAlign: 'center', color: activeTab === 'dashboard' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{ fontSize: '20px' }}>📊</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Dashboard</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'shops' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('shops')}>
          <div style={{ fontSize: '20px' }}>🏪</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Shops</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'orders' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
          <div style={{ fontSize: '20px' }}>📥</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Orders</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'catalog' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>
          <div style={{ fontSize: '20px' }}>📦</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Catalog</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'history' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('history')}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>History</span>
        </div>
      </div>

    </div>
  );
};

export default DistributorDashboard;
