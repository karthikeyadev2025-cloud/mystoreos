import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ revenue: 0, activeShops: 0, customers: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [razorpayKey, setRazorpayKey] = useState('');

  const loadData = async () => {
    const data = await api.getAdminStats();
    const settings = await api.getSettings();
    setRazorpayKey(settings.razorpayKey || '');
    setStats({
      revenue: data.revenue || '₹0',
      activeShops: data.totalShops || 0,
      paidShops: data.paidShops || 0,
      customers: data.totalUsers || 0
    });
    setPendingUsers(await api.getPendingApprovals());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (userId) => {
    await api.approveUser(userId);
    alert('User Approved!');
    loadData();
  };

  const handleSaveSettings = async () => {
    await api.saveSettings({ razorpayKey });
    alert("System Settings Saved Successfully!");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const styles = {
    bg: { backgroundColor: '#050505', color: '#e2e8f0', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
    header: { background: 'linear-gradient(135deg, #dc2626, #7c2d12)', padding: '16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    superStats: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px' },
    superBox: { background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 12px', textAlign: 'center', position: 'relative', overflow: 'hidden' },
    secHeader: { padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    shopCard: { background: 'linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.6))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', margin: '0 12px 12px', padding: '16px' },
    shopStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' },
    shopStat: { background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' },
    shopActions: { display: 'flex', gap: '8px' },
    alertBar: { background: 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(220,38,38,0.2))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '12px 16px', margin: '0 12px 12px', display: 'flex', alignItems: 'center', gap: '10px' },
    bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'linear-gradient(180deg, rgba(15,23,42,0.98), #000)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '8px 0 12px', zIndex: 100 }
  };

  return (
    <div style={styles.bg}>
      <div style={styles.header}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>🔴 MyStore Admin</h1>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Super Admin • Guntur Region</div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px' }}>Logout</button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div style={styles.superStats}>
            <div style={{...styles.superBox, borderTop: '3px solid #16a34a'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#16a34a'}}>{stats.revenue}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Monthly Revenue</div>
              <div style={{fontSize: '10px', color: '#16a34a', marginTop: 4}}>from subscriptions</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #3b82f6'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#3b82f6'}}>{stats.activeShops}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Total Shops</div>
              <div style={{fontSize: '10px', color: '#3b82f6', marginTop: 4}}>{stats.paidShops} paid</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #fbbf24'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#fbbf24'}}>{stats.customers}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Total Customers</div>
              <div style={{fontSize: '10px', color: '#16a34a', marginTop: 4}}>All shops</div>
            </div>
            <div style={{...styles.superBox, borderTop: '3px solid #f87171'}}>
              <div style={{fontSize: '28px', fontWeight: 800, color: '#f87171'}}>{pendingUsers.length}</div>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)'}}>Pending Approvals</div>
              <div style={{fontSize: '10px', color: '#f87171', marginTop: 4}}>Action Required</div>
            </div>
          </div>

          {pendingUsers.length > 0 && (
            <div style={{ margin: '0 12px 12px' }}>
              <h3 style={{ fontSize: '14px', color: '#f87171', marginBottom: '8px' }}>⚠️ Pending Verifications</h3>
              {pendingUsers.map(u => (
                <div key={u.id} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', padding: '12px', borderRadius: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{u.name}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Phone: {u.phone} • Type: {u.role}</p>
                  </div>
                  <button onClick={() => handleApprove(u.id)} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.alertBar}>
            <span style={{fontSize: '20px'}}>⚠️</span>
            <p style={{fontSize: '13px', margin: 0}}><b>Sai Supermarket</b> payment overdue by 5 days. ₹999 due.</p>
          </div>

          <div style={styles.secHeader}>
            <h2 style={{fontSize: '16px', fontWeight: 700, color: '#fbbf24', margin: 0}}>🏪 My Shops</h2>
            <button style={{background: 'linear-gradient(135deg, #dc2626, #f59e0b)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'}}>+ Add Shop</button>
          </div>

          <div style={styles.shopCard}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <h3 style={{fontSize: '16px', fontWeight: 700, margin: 0}}>🛒 Sai Supermarket</h3>
              <span style={{background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700}}>⚠️ Payment Due</span>
            </div>
            <div style={styles.shopStats}>
              <div style={styles.shopStat}><div style={{fontSize: '16px', fontWeight: 700, color: '#fbbf24'}}>₹45K</div><div style={{fontSize: '9px', color: 'rgba(255,255,255,0.5)'}}>Revenue</div></div>
              <div style={styles.shopStat}><div style={{fontSize: '16px', fontWeight: 700, color: '#fbbf24'}}>320</div><div style={{fontSize: '9px', color: 'rgba(255,255,255,0.5)'}}>Orders</div></div>
              <div style={styles.shopStat}><div style={{fontSize: '16px', fontWeight: 700, color: '#fbbf24'}}>89</div><div style={{fontSize: '9px', color: 'rgba(255,255,255,0.5)'}}>Customers</div></div>
            </div>
            <div style={styles.shopActions}>
              <button style={{flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 700, background: 'rgba(59,130,246,0.2)', color: '#60a5fa'}}>👁️ View</button>
              <button style={{flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 700, background: 'rgba(251,191,36,0.2)', color: '#fbbf24'}}>🧾 Bills</button>
              <button style={{flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 700, background: 'rgba(220,38,38,0.2)', color: '#f87171'}}>📢 Remind</button>
            </div>
          </div>
        </>
      )}

      {/* Placeholders for other tabs */}
      {activeTab === 'shops' && <div style={{padding: 20}}><h2>All Shops</h2></div>}
      {activeTab === 'customers' && <div style={{padding: 20}}><h2>Customers</h2></div>}
      {activeTab === 'payments' && <div style={{padding: 20}}><h2>Payments</h2></div>}
      
      {activeTab === 'settings' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>System Settings</h2>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Manage API Keys and Platform Configuration</p>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
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
          </div>
        </div>
      )}

      <div style={styles.bottomNav}>
        {[
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'shops', icon: '🏪', label: 'Shops' },
          { id: 'customers', icon: '👥', label: 'Customers' },
          { id: 'payments', icon: '💰', label: 'Payments' },
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
