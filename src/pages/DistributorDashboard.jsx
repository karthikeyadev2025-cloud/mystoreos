import React, { useState, useEffect } from 'react';
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
  
  // New Credit Form
  const [selectedShop, setSelectedShop] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    setCredits(await api.getDistCredits(user.id));
    setShops(await api.getAllShops());
  };

  useEffect(() => { loadData(); }, []);

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
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>Logout</button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div style={{ padding: '16px' }}>
            <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Total Market Outstanding</p>
              <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#ef4444', margin: '8px 0' }}>₹{totalOutstanding}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
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

      {/* Placeholders */}
      {activeTab === 'shops' && <div style={{padding: 20}}><h2>My Shops</h2><p style={{color:'#94a3b8'}}>List of shops and total ledgers.</p></div>}
      {activeTab === 'history' && <div style={{padding: 20}}><h2>Collection History</h2><p style={{color:'#94a3b8'}}>Past cleared records.</p></div>}

      {/* Add Credit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
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

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-around', padding: '12px 0', zIndex: 90 }}>
        <div style={{ textAlign: 'center', color: activeTab === 'dashboard' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{ fontSize: '20px' }}>📊</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Dashboard</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'shops' ? '#3b82f6' : '#64748b', cursor: 'pointer' }} onClick={() => setActiveTab('shops')}>
          <div style={{ fontSize: '20px' }}>🏪</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Shops</span>
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
