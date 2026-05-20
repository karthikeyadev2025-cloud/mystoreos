import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ revenue: '₹0', totalShops: 0, paidShops: 0, totalUsers: 0, totalDistributors: 0, totalOrders: 0, activeCredit: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [razorpayKey, setRazorpayKey] = useState('');
  
  const [shops, setShops] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const loadData = async () => {
    const data = await api.getAdminStats();
    const settings = await api.getSettings();
    setRazorpayKey(settings.razorpayKey || '');
    setStats(data);
    setPendingUsers(await api.getPendingApprovals());
    setShops(await api.getAllShops());
    setCustomers(await api.getAllUsersByRole('customer'));
    setDistributors(await api.getAllUsersByRole('distributor'));
    setAllUsers(await api.getAllUsersByRole());
  };

  useEffect(() => { loadData(); }, []);

  const handleApprove = async (userId) => {
    await api.approveUser(userId);
    toast.success('User Approved & Activated!');
    loadData();
  };

  const handleReject = async (userId) => {
    if (window.confirm("Reject and permanently delete this user?")) {
      await api.deleteUser(userId);
      toast.success('User Rejected & Removed.');
      loadData();
    }
  };
  
  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      await api.deleteUser(userId);
      toast.success('User Deleted!');
      loadData();
    }
  };

  const handleSaveSettings = async () => {
    await api.saveSettings({ razorpayKey });
    toast.success("System Settings Saved Successfully!");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const styles = {
    bg: { backgroundColor: '#050505', color: '#e2e8f0', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
    header: { background: 'linear-gradient(135deg, #dc2626, #7c2d12)', padding: '16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    superStats: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px' },
    superBox: { background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 12px', textAlign: 'center' },
    shopCard: { background: 'linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.6))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', margin: '0 12px 12px', padding: '16px' },
    bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'linear-gradient(180deg, rgba(15,23,42,0.98), #000)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '8px 0 12px', zIndex: 100 },
    listCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }
  };

  return (
    <div style={styles.bg}>
      <ToastContainer theme="dark" position="top-center" />
      
      <div style={styles.header}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>🔴 MyStore Admin</h1>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Super Admin • {user.name}</div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Logout</button>
      </div>

      {/* ===== DASHBOARD TAB ===== */}
      {activeTab === 'dashboard' && (
        <>
          <div style={styles.superStats}>
            <div style={{...styles.superBox, borderTop: '3px solid #16a34a'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#16a34a'}}>{stats.revenue}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Monthly Revenue</div>
              <div style={{fontSize: '10px', color: '#16a34a', marginTop: 4}}>{stats.paidShops} paid shops × ₹999</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #3b82f6'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#3b82f6'}}>{stats.totalShops}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Total Shops</div>
              <div style={{fontSize: '10px', color: '#3b82f6', marginTop: 4}}>{stats.paidShops} paid</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #fbbf24'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#fbbf24'}}>{stats.totalUsers}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Total Customers</div>
              <div style={{fontSize: '10px', color: '#fbbf24', marginTop: 4}}>{stats.totalOrders} orders placed</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #f87171'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#f87171'}}>{pendingUsers.length}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Pending Approvals</div>
              <div style={{fontSize: '10px', color: '#f87171', marginTop: 4}}>Action Required</div>
            </div>
          </div>

          {/* Extra Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '0 12px 12px' }}>
            <div style={{...styles.superBox, padding: '12px 8px'}}>
              <div style={{fontSize: '20px', fontWeight: 800, color: '#a78bfa'}}>{stats.totalDistributors}</div>
              <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.5)'}}>Distributors</div>
            </div>
            <div style={{...styles.superBox, padding: '12px 8px'}}>
              <div style={{fontSize: '20px', fontWeight: 800, color: '#fb923c'}}>{stats.totalOrders}</div>
              <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.5)'}}>Total Orders</div>
            </div>
            <div style={{...styles.superBox, padding: '12px 8px'}}>
              <div style={{fontSize: '20px', fontWeight: 800, color: '#ef4444'}}>₹{stats.activeCredit}</div>
              <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.5)'}}>Active Credit</div>
            </div>
          </div>

          {/* Pending Approvals */}
          {pendingUsers.length > 0 && (
            <div style={{ margin: '0 12px 12px' }}>
              <h3 style={{ fontSize: '14px', color: '#f87171', marginBottom: '8px' }}>⚠️ Pending Verifications ({pendingUsers.length})</h3>
              {pendingUsers.map(u => (
                <div key={u.id} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', padding: '12px', borderRadius: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px' }}>{u.name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>📞 {u.phone} • 🏷️ {u.role.toUpperCase()}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleApprove(u.id)} style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      ✅ Approve
                    </button>
                    <button onClick={() => handleReject(u.id)} style={{ flex: 1, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Shops */}
          <div style={{ padding: '4px 16px 0' }}>
            <h2 style={{fontSize: '16px', fontWeight: 700, color: '#fbbf24', margin: '0 0 12px 0'}}>🏪 Registered Shops</h2>
          </div>
          {shops.length === 0 ? (
             <p style={{textAlign: 'center', color: '#94a3b8', fontSize: '14px'}}>No shops registered yet.</p>
          ) : (
            shops.map(shop => (
              <div key={shop.id} style={styles.shopCard}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: 700, margin: 0}}>🛒 {shop.name}</h3>
                  {shop.subscription === 'active' 
                    ? <span style={{background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700}}>✅ PRO</span>
                    : <span style={{background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700}}>⚠️ Free Trial</span>
                  }
                </div>
                <p style={{margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8'}}>📞 {shop.phone} • Status: {shop.status}</p>
                <button onClick={() => handleDelete(shop.id)} style={{padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 700, background: 'rgba(220,38,38,0.2)', color: '#f87171', cursor: 'pointer'}}>🗑️ Delete Shop</button>
              </div>
            ))
          )}
        </>
      )}

      {/* ===== SHOPS TAB ===== */}
      {activeTab === 'shops' && (
        <div style={{padding: 16}}>
          <h2 style={{margin: '0 0 16px 0', fontSize: '18px'}}>All Registered Shops ({shops.length})</h2>
          {shops.length === 0 && <p style={{color: '#94a3b8'}}>No shops found.</p>}
          {shops.map(shop => (
            <div key={shop.id} style={{...styles.listCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{margin: 0, fontSize: '16px'}}>{shop.name}</h4>
                <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>📞 {shop.phone}</p>
                <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Status: <span style={{color: shop.status === 'active' ? '#22c55e' : '#f59e0b'}}>{shop.status}</span> | Plan: <span style={{color: shop.subscription === 'active' ? '#22c55e' : '#f59e0b'}}>{shop.subscription === 'active' ? 'PRO ₹999' : 'Free Trial'}</span></p>
              </div>
              <button onClick={() => handleDelete(shop.id)} style={{background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap'}}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* ===== CUSTOMERS TAB ===== */}
      {activeTab === 'customers' && (
        <div style={{padding: 16}}>
          <h2 style={{margin: '0 0 16px 0', fontSize: '18px'}}>All Customers ({customers.length})</h2>
          {customers.length === 0 && <p style={{color: '#94a3b8'}}>No customers found.</p>}
          {customers.map(cust => (
            <div key={cust.id} style={{...styles.listCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{margin: 0, fontSize: '16px'}}>{cust.name}</h4>
                <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>📞 {cust.phone}</p>
              </div>
              <button onClick={() => handleDelete(cust.id)} style={{background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer'}}>Delete</button>
            </div>
          ))}

          <h2 style={{margin: '24px 0 16px 0', fontSize: '18px'}}>All Distributors ({distributors.length})</h2>
          {distributors.length === 0 && <p style={{color: '#94a3b8'}}>No distributors found.</p>}
          {distributors.map(dist => (
            <div key={dist.id} style={{...styles.listCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{margin: 0, fontSize: '16px'}}>{dist.name}</h4>
                <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>📞 {dist.phone} • Status: {dist.status}</p>
              </div>
              <button onClick={() => handleDelete(dist.id)} style={{background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer'}}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* ===== PAYMENTS TAB ===== */}
      {activeTab === 'payments' && (
        <div style={{padding: 16}}>
          <h2 style={{margin: '0 0 8px 0', fontSize: '18px'}}>Subscription Revenue</h2>
          <div style={{...styles.superBox, borderTop: '3px solid #16a34a', marginBottom: '16px', padding: '20px'}}>
            <div style={{fontSize: '36px', fontWeight: 900, color: '#16a34a'}}>{stats.revenue}</div>
            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px'}}>{stats.paidShops} of {stats.totalShops} shops have paid</div>
          </div>
          <h3 style={{fontSize: '14px', color: '#94a3b8', marginBottom: '12px'}}>Shop-by-Shop Breakdown</h3>
          {shops.map(shop => (
            <div key={shop.id} style={{...styles.listCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{margin: 0, fontSize: '16px'}}>{shop.name}</h4>
                <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>📞 {shop.phone}</p>
              </div>
              <div>
                {shop.subscription === 'active' ? (
                  <span style={{background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700}}>Paid ₹999</span>
                ) : (
                  <span style={{background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700}}>Free Trial</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* ===== SETTINGS TAB ===== */}
      {activeTab === 'settings' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>System Settings</h2>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Manage API Keys and Platform Configuration</p>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🔑 Razorpay API Configuration</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Enter your live Razorpay Key ID here. This key will be dynamically injected into the Shopkeeper dashboards so they can pay their ₹999 PRO subscription directly to your account.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>Razorpay Key ID</label>
                <input 
                  type="text" value={razorpayKey} onChange={e => setRazorpayKey(e.target.value)} 
                  placeholder="e.g. rzp_live_xxxxxxxxxxx" 
                  style={{ width: '100%', padding: '14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                />
              </div>
              <button onClick={handleSaveSettings} style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Keys to System
              </button>
            </div>

            {/* Platform Summary */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>📊 Platform Summary</h3>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <div>Total Users in System: <b style={{color: '#fff'}}>{allUsers.length}</b></div>
                <div>Shops: <b style={{color: '#3b82f6'}}>{stats.totalShops}</b> | Customers: <b style={{color: '#fbbf24'}}>{stats.totalUsers}</b> | Distributors: <b style={{color: '#a78bfa'}}>{stats.totalDistributors}</b></div>
                <div>Pending Approvals: <b style={{color: pendingUsers.length > 0 ? '#ef4444' : '#22c55e'}}>{pendingUsers.length}</b></div>
                <div>Active Credit Outstanding: <b style={{color: '#ef4444'}}>₹{stats.activeCredit}</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.bottomNav}>
        {[
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'shops', icon: '🏪', label: 'Shops' },
          { id: 'customers', icon: '👥', label: 'Users' },
          { id: 'payments', icon: '💰', label: 'Revenue' },
          { id: 'settings', icon: '⚙️', label: 'Settings' }
        ].map(tab => (
          <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ textAlign: 'center', color: activeTab === tab.id ? '#fbbf24' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '2px' }}>{tab.icon}</span>
            <span style={{ fontSize: '9px', fontWeight: 600 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
