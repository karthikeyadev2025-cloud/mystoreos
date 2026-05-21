import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminCMS from './AdminCMS';
import { 
  LayoutDashboard, Store, Users, FileText, Settings, CreditCard, LogOut, CheckCircle, 
  XCircle, Trash2, Key, Download, ShieldCheck, 
  Activity, ArrowUpRight, Search, PlusCircle, Globe, Sparkles, RefreshCw, Eye, EyeOff
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ revenue: '₹0', totalShops: 0, paidShops: 0, totalUsers: 0, totalDistributors: 0, totalOrders: 0, activeCredit: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [razorpayKey, setRazorpayKey] = useState('');
  
  const [shops, setShops] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [resetModal, setResetModal] = useState({ show: false, userId: null, userName: '', newPass: '' });
  
  // Advanced features state
  const [globalCredits, setGlobalCredits] = useState([]);
  const [globalOrders, setGlobalOrders] = useState([]);
  const [revealedPINs, setRevealedPINs] = useState({});
  
  // Enterprise features: Live Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('all'); // all, pro, trial
  const [userFilter, setUserFilter] = useState('all'); // all, customer, distributor
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic SaaS plans state
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getAdminStats();
      const settings = await api.getSettings();
      setRazorpayKey(settings.razorpayKey || '');
      setStats(data);
      setPendingUsers(await api.getPendingApprovals());
      setShops(await api.getAllShops());
      setAllUsers(await api.getAllUsersByRole());
      setGlobalCredits(await api.getGlobalCredits());
      setGlobalOrders(await api.getGlobalOrders());
      setPlans(await api.getSubscriptionPlans());
    } catch {
      toast.error("Failed to refresh enterprise metrics");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan.id || !editingPlan.name || !editingPlan.price) {
      return toast.error("Please fill in plan ID, name, and price!");
    }
    try {
      let updatedPlans;
      const isNew = !plans.some(p => p.id === editingPlan.id);
      if (isNew) {
        updatedPlans = [...plans, { ...editingPlan, price: Number(editingPlan.price) }];
      } else {
        updatedPlans = plans.map(p => p.id === editingPlan.id ? { ...editingPlan, price: Number(editingPlan.price) } : p);
      }
      await api.saveSubscriptionPlans(updatedPlans);
      setPlans(updatedPlans);
      setShowPlanModal(false);
      setEditingPlan(null);
      toast.success(isNew ? "Plan added successfully!" : "Plan updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to save plan");
    }
  };

  const handleDeletePlan = async (planId) => {
    if (window.confirm("Are you sure you want to delete this subscription plan?")) {
      try {
        const updatedPlans = plans.filter(p => p.id !== planId);
        await api.saveSubscriptionPlans(updatedPlans);
        setPlans(updatedPlans);
        toast.success("Plan deleted successfully!");
      } catch (err) {
        toast.error(err.message || "Failed to delete plan");
      }
    }
  };

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    setEditingPlan(prev => ({
      ...prev,
      features: [...(prev.features || []), newFeature.trim()]
    }));
    setNewFeature('');
  };

  const handleRemoveFeature = (index) => {
    setEditingPlan(prev => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index)
    }));
  };

  const togglePINReveal = (userId) => {
    setRevealedPINs(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleToggleSubscription = async (shopId, currentSubscription) => {
    const nextSub = currentSubscription === 'active' ? 'trial' : 'active';
    const actionLabel = nextSub === 'active' ? 'UPGRADE to PRO Enterprise' : 'DOWNGRADE to Free Trial';
    if (window.confirm(`Are you sure you want to ${actionLabel} this store?`)) {
      try {
        await api.updateProfile(shopId, { subscription: nextSub });
        toast.success(`Store subscription modified successfully!`);
        loadData();
      } catch (err) {
        toast.error(err.message || 'Failed to toggle subscription');
      }
    }
  };

  const handleSettleCredit = async (creditId) => {
    if (window.confirm("Are you sure you want to manually settle this distributor outstanding debt record?")) {
      try {
        await api.markCreditPaid(creditId);
        toast.success("Credit voucher marked as SETTLED!");
        loadData();
      } catch (err) {
        toast.error(err.message || "Failed to settle credit voucher");
      }
    }
  };

  const handleApprove = async (userId) => {
    try {
      await api.approveUser(userId);
      toast.success('Organization Approved & Credentials Provisioned!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to approve user');
    }
  };

  const handleReject = async (userId) => {
    if (window.confirm("Permanently reject and delete this enterprise registration?")) {
      try {
        await api.deleteUser(userId);
        toast.warn('Registration Rejected & Cleared.');
        loadData();
      } catch (err) {
        toast.error(err.message || 'Failed to reject user');
      }
    }
  };
  
  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to permanently delete this user? This will delete all products, bills, and credit logs linked to them!")) {
      try {
        await api.deleteUser(userId);
        toast.success('Record Cleared Successfully.');
        loadData();
      } catch (err) {
        toast.error(err.message || 'Failed to delete user');
      }
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (resetModal.newPass.length < 4) return toast.error('Security keys must be at least 4 characters');
    try {
      await api.adminResetPassword(resetModal.userId, resetModal.newPass);
      toast.success(`Access credentials updated for ${resetModal.userName}`);
      setResetModal({ show: false, userId: null, userName: '', newPass: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to update access key');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.saveSettings({ razorpayKey });
      toast.success("Merchant Gateway Settings Saved Successfully!");
    } catch (err) {
      toast.error(err.message || 'Failed to save settings');
    }
  };

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) return toast.error("No record sets to export");
    const headers = Object.keys(data[0]).join(',');
    const csvRows = data.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvString = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Spreadsheet downloaded successfully!");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Modern Enterprise Styling Object
  const styles = {
    wrapper: {
      backgroundColor: '#05070e',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #131230 0%, #030408 80%)',
      color: '#f8fafc',
      minHeight: '100vh',
      fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'row',
      overflowX: 'hidden'
    },
    sidebar: {
      width: '280px',
      background: 'rgba(10, 13, 26, 0.85)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      padding: '24px 16px',
      boxSizing: 'border-box'
    },
    mainContent: {
      flex: 1,
      padding: '32px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    },
    glassCard: {
      background: 'linear-gradient(135deg, rgba(20, 25, 46, 0.5) 0%, rgba(10, 13, 26, 0.7) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(16px)'
    },
    statBox: {
      padding: '24px',
      borderRadius: '20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
    },
    badge: {
      padding: '4px 10px',
      borderRadius: '30px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    },
    navItem: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: '12px',
      color: active ? '#fff' : '#94a3b8',
      background: active ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
      border: 'none',
      fontSize: '15px',
      fontWeight: active ? '700' : '500',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
      marginBottom: '8px',
      boxShadow: active ? '0 10px 20px rgba(99, 102, 241, 0.3)' : 'none',
      transition: 'all 0.2s ease'
    }),
    mobileNav: {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      right: '16px',
      background: 'rgba(8, 12, 26, 0.85)',
      backdropFilter: 'blur(30px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '12px 8px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      zIndex: 999
    },
    actionBtn: {
      padding: '10px 18px',
      borderRadius: '12px',
      fontWeight: 'bold',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    input: {
      background: 'rgba(10, 13, 26, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '14px 16px',
      color: '#fff',
      fontSize: '14px',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box'
    }
  };

  // Responsive Hook Simulation
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter Data Sets based on search parameters
  const filteredShops = shops.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || '').includes(searchTerm);
    if (shopFilter === 'pro') return matchesSearch && s.subscription === 'active';
    if (shopFilter === 'trial') return matchesSearch && s.subscription !== 'active';
    return matchesSearch;
  });

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.phone || '').includes(searchTerm);
    if (userFilter === 'customer') return matchesSearch && u.role === 'customer';
    if (userFilter === 'distributor') return matchesSearch && u.role === 'distributor';
    if (userFilter === 'staff') return matchesSearch && u.role === 'staff';
    if (userFilter === 'ca') return matchesSearch && u.role === 'ca';
    return matchesSearch && u.role !== 'admin';
  });

  return (
    <div style={styles.wrapper}>
      <ToastContainer theme="dark" position="top-right" />
      
      {/* ===== DESKTOP SIDEBAR ===== */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <div style={{ background: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 900, margin: 0, letterSpacing: '0.05em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MYSTORE OS</h2>
              <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span> Enterprise Platform
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {[
              { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
              { id: 'shops', icon: <Store size={18} />, label: 'Manage Shops' },
              { id: 'customers', icon: <Users size={18} />, label: 'User Directory' },
              { id: 'credits', icon: <FileText size={18} />, label: 'Global Credits' },
              { id: 'cms', icon: <Globe size={18} />, label: 'Website CMS' },
              { id: 'payments', icon: <CreditCard size={18} />, label: 'Revenue Analytics' },
              { id: 'settings', icon: <Settings size={18} />, label: 'System Settings' }
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }} style={styles.navItem(activeTab === tab.id)}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: '#1e293b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>A</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Super Administrator</div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <LogOut size={14} /> Close Session
            </button>
          </div>
        </div>
      )}

      {/* ===== MAIN PANEL CONTENT ===== */}
      <div style={{...styles.mainContent, paddingBottom: isMobile ? '120px' : '32px'}}>
        
        {/* Top Header Row for Mobile */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(10, 13, 26, 0.5)', padding: '14px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 900, margin: 0, letterSpacing: '0.05em' }}>🔴 MYSTORE OS</h1>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Admin • {user.name}</div>
            </div>
            <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Logout</button>
          </div>
        )}

        {/* Section Header */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                {activeTab === 'dashboard' && 'Platform Overview'}
                {activeTab === 'shops' && 'Shopkeepers Ecosystem'}
                {activeTab === 'customers' && 'Global Registry'}
                {activeTab === 'credits' && 'Global Credit & Sales Registry'}
                {activeTab === 'cms' && 'Dynamic Content Engine'}
                {activeTab === 'payments' && 'SaaS Revenue Metrics'}
                {activeTab === 'settings' && 'System Parameters'}
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                {activeTab === 'dashboard' && 'Manage shop configurations, new requests, and aggregate analytics.'}
                {activeTab === 'shops' && 'Audit subscription terms, manage accounts, and export shop spreadsheets.'}
                {activeTab === 'customers' && 'View customer directories, distributors, and credentials reset logs.'}
                {activeTab === 'credits' && 'Audit all system-wide FMCG supplier outstanding books and sales return vouchers.'}
                {activeTab === 'cms' && 'Manage live landing page configurations and announcement boards instantly.'}
                {activeTab === 'payments' && 'Monitor premium plans conversions, pending balances, and total sales.'}
                {activeTab === 'settings' && 'Setup merchant APIs, payment links, and verify database integrity.'}
              </p>
            </div>
            <button onClick={loadData} disabled={isRefreshing} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} /> {isRefreshing ? 'Syncing...' : 'Sync Live'}
            </button>
          </div>
        )}

        {/* ===== DASHBOARD TAB CONTENT ===== */}
        {activeTab === 'dashboard' && (
          <>
            {/* GRID METRICS */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
              
              {/* Card 1 */}
              <div style={{...styles.statBox, ...styles.glassCard, borderTop: '4px solid #10b981'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Monthly Sales</span>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', letterSpacing: '-0.03em' }}>{stats.revenue}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', justifyItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{stats.paidShops}</span> active premium shops
                </div>
              </div>

              {/* Card 2 */}
              <div style={{...styles.statBox, ...styles.glassCard, borderTop: '4px solid #6366f1'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Total Shopkeepers</span>
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Store size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>{stats.totalShops}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{stats.totalShops - stats.paidShops}</span> on trial terms
                </div>
              </div>

              {/* Card 3 */}
              <div style={{...styles.statBox, ...styles.glassCard, borderTop: '4px solid #f59e0b'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Customer Count</span>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>{stats.totalUsers}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{stats.totalOrders}</span> transaction logs
                </div>
              </div>

              {/* Card 4 */}
              <div style={{...styles.statBox, ...styles.glassCard, borderTop: '4px solid #ef4444'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Pending Verifications</span>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: pendingUsers.length > 0 ? '#ef4444' : '#fff', letterSpacing: '-0.03em' }}>{pendingUsers.length}</div>
                <div style={{ fontSize: '11px', color: pendingUsers.length > 0 ? '#ef4444' : '#94a3b8', marginTop: '6px', fontWeight: pendingUsers.length > 0 ? 'bold' : 'normal' }}>
                  {pendingUsers.length > 0 ? '⚠️ Immediate Action Required' : '✓ All audits complete'}
                </div>
              </div>

            </div>

            {/* SECONDARY SUMMARY ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
              <div style={{...styles.glassCard, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
                <div style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#c084fc', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlusCircle size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900 }}>{stats.totalDistributors}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Partner Distributors</div>
                </div>
              </div>
              <div style={{...styles.glassCard, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
                <div style={{ background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900 }}>{stats.totalOrders}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total System Orders</div>
                </div>
              </div>
              <div style={{...styles.glassCard, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171' }}>₹{stats.activeCredit}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Outstanding Credit Ledger</div>
                </div>
              </div>
            </div>

            {/* SAAS TRIAL VS PRO GROWTH CHART */}
            <div style={{...styles.glassCard, marginBottom: '32px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>📈 SaaS Enterprise Subscription Growth</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Monthly trends of Free Trial vs Premium PRO conversions</p>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8' }}>
                    <span style={{ width: '12px', height: '4px', background: '#818cf8', display: 'inline-block', borderRadius: '2px' }}></span> Free Trials
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                    <span style={{ width: '12px', height: '4px', background: '#10b981', display: 'inline-block', borderRadius: '2px' }}></span> Premium PRO
                  </span>
                </div>
              </div>

              {/* Inline SVG Chart */}
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg viewBox="0 0 800 240" style={{ width: '100%', minWidth: '600px', height: '220px', overflow: 'visible' }}>
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="750" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <line x1="50" y1="70" x2="750" y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <line x1="50" y1="120" x2="750" y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <line x1="50" y1="170" x2="750" y2="170" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <line x1="50" y1="210" x2="750" y2="210" stroke="rgba(255,255,255,0.1)" />

                  {/* Months Labels (Axis X) */}
                  <text x="50" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">Jan</text>
                  <text x="190" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">Feb</text>
                  <text x="330" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">Mar</text>
                  <text x="470" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">Apr</text>
                  <text x="610" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">May</text>
                  <text x="750" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">Jun</text>

                  {/* Y Axis Labels */}
                  <text x="40" y="25" fill="#64748b" fontSize="10" textAnchor="end">100</text>
                  <text x="40" y="75" fill="#64748b" fontSize="10" textAnchor="end">75</text>
                  <text x="40" y="125" fill="#64748b" fontSize="10" textAnchor="end">50</text>
                  <text x="40" y="175" fill="#64748b" fontSize="10" textAnchor="end">25</text>
                  <text x="40" y="215" fill="#64748b" fontSize="10" textAnchor="end">0</text>

                  {/* Free Trial Trend Line (Purple) */}
                  <path 
                    d="M 50 190 Q 190 160 330 120 T 610 60 T 750 40" 
                    fill="none" 
                    stroke="#818cf8" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  {/* Premium PRO Trend Line (Green) */}
                  <path 
                    d="M 50 210 Q 190 195 330 175 T 610 95 T 750 50" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />

                  {/* Area fill for curves */}
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                  </linearGradient>
                  <path 
                    d="M 50 190 Q 190 160 330 120 T 610 60 T 750 40 L 750 210 L 50 210 Z" 
                    fill="url(#purpleGrad)" 
                  />

                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <path 
                    d="M 50 210 Q 190 195 330 175 T 610 95 T 750 50 L 750 210 L 50 210 Z" 
                    fill="url(#greenGrad)" 
                  />

                  {/* Dots on points */}
                  <circle cx="50" cy="190" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="190" cy="160" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="330" cy="120" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="470" cy="90" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="610" cy="60" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="750" cy="40" r="4.5" fill="#818cf8" stroke="#05070e" strokeWidth="1.5" />

                  <circle cx="50" cy="210" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="190" cy="195" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="330" cy="175" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="470" cy="140" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="610" cy="95" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                  <circle cx="750" cy="50" r="4.5" fill="#10b981" stroke="#05070e" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* PENDING APPROVALS LIST */}
            {pendingUsers.length > 0 && (
              <div style={{...styles.glassCard, border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', color: '#ef4444', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <Sparkles size={18} /> ACTION NEEDED: Organization Approvals ({pendingUsers.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingUsers.map(u => (
                    <div key={u.id} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '16px', borderRadius: '14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>🏢 {u.name}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                          📞 {u.phone} • Role: <span style={{...styles.badge, background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'inline-block'}}>{u.role}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleApprove(u.id)} style={{...styles.actionBtn, background: '#10b981', color: '#fff', padding: '8px 16px' }}>
                          <CheckCircle size={14} /> Approve & Grant Access
                        </button>
                        <button onClick={() => handleReject(u.id)} style={{...styles.actionBtn, background: 'transparent', border: '1px solid #ef4444', color: '#f87171', padding: '8px 16px' }}>
                          <XCircle size={14} /> Deny Entry
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DYNAMIC METRICS OVERVIEW */}
            <div style={styles.glassCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>🏪 Active Onboarded Stores</h3>
                <span style={{ fontSize: '12px', color: '#cbd5e1', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setActiveTab('shops')}>View Directory →</span>
              </div>
              
              {shops.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <Store size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ margin: 0 }}>No partner shops are currently configured in the database.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {shops.slice(0, 4).map(shop => (
                    <div key={shop.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>🛒 {shop.name}</h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>📞 {shop.phone}</span>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Status: {shop.status}</span>
                        </div>
                      </div>
                      <div>
                        {shop.subscription === 'active' 
                          ? <span style={{...styles.badge, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981'}}>✓ Enterprise PRO</span>
                          : <span style={{...styles.badge, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24'}}>Free Trial</span>
                        }
                      </div>
                    </div>
                  ))}
                  {shops.length > 4 && (
                    <button onClick={() => setActiveTab('shops')} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                      Show All {shops.length} Partner Organizations
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== SHOPS TAB CONTENT ===== */}
        {activeTab === 'shops' && (
          <div style={styles.glassCard}>
            
            {/* Header + Search bar */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Shopkeepers Registry ({filteredShops.length})</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Total SaaS nodes on network</span>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignSelf: 'stretch', flexWrap: 'wrap' }}>
                <button onClick={() => downloadCSV(shops, 'shops_directory')} style={{...styles.actionBtn, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                  <Download size={14} /> Export Spreadsheet
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <input 
                  type="text" 
                  placeholder="Search by store name or phone..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  style={{...styles.input, paddingLeft: '40px'}} 
                />
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <div style={{ display: 'flex', background: 'rgba(10, 13, 26, 0.5)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pro', label: 'Enterprise PRO' },
                  { id: 'trial', label: 'Free Trial' }
                ].map(filterItem => (
                  <button 
                    key={filterItem.id}
                    onClick={() => setShopFilter(filterItem.id)}
                    style={{ background: shopFilter === filterItem.id ? '#6366f1' : 'transparent', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {filterItem.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {filteredShops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <Store size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>No partner shops found matching current criteria.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredShops.map(shop => (
                  <div key={shop.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', transition: 'border-color 0.2s' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>🛒 {shop.name}</h4>
                        {shop.subscription === 'active' 
                          ? <span style={{...styles.badge, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981'}}>✓ Enterprise PRO</span>
                          : <span style={{...styles.badge, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24'}}>Free Trial</span>
                        }
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>📞 {shop.phone}</span>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                        <span>Node Status: <b style={{ color: (shop.status || '') === 'active' ? '#10b981' : '#f59e0b' }}>{(shop.status || 'unknown').toUpperCase()}</b></span>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }} onClick={() => togglePINReveal(shop.id)}>
                          {revealedPINs[shop.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>PIN/Pass: <b>{revealedPINs[shop.id] ? (shop.pass || '1234') : '••••'}</b></span>
                        </span>
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => handleToggleSubscription(shop.id, shop.subscription)} style={{...styles.actionBtn, background: shop.subscription === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: shop.subscription === 'active' ? '#f87171' : '#10b981', border: `1px solid ${shop.subscription === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}` }}>
                        🔄 {shop.subscription === 'active' ? 'Downgrade' : 'Upgrade PRO'}
                      </button>
                      <button onClick={() => setResetModal({ show: true, userId: shop.id, userName: shop.name, newPass: '' })} style={{...styles.actionBtn, background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Key size={13} /> Reset PIN
                      </button>
                      <button onClick={() => handleDelete(shop.id)} style={{...styles.actionBtn, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <Trash2 size={13} /> Delete Account
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ===== USER DIRECTORY TAB CONTENT ===== */}
        {activeTab === 'customers' && (
          <div style={styles.glassCard}>
            
            {/* Header + Actions */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Customer & Distributors Registry ({filteredUsers.length})</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Platform global client accounts</span>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => downloadCSV(filteredUsers, 'users_directory')} style={{...styles.actionBtn, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', width: isMobile ? '100%' : 'auto' }}>
                  <Download size={14} /> Export Spreadsheet
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <input 
                  type="text" 
                  placeholder="Search by client name or phone..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  style={{...styles.input, paddingLeft: '40px'}} 
                />
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <div style={{ display: 'flex', background: 'rgba(10, 13, 26, 0.5)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', maxWidth: '100%' }}>
                {[
                  { id: 'all', label: 'All Platform Clients' },
                  { id: 'customer', label: 'Customers' },
                  { id: 'distributor', label: 'Distributors' },
                  { id: 'staff', label: 'Staff Helpers' },
                  { id: 'ca', label: 'Accountants (CA)' }
                ].map(filterItem => (
                  <button 
                    key={filterItem.id}
                    onClick={() => setUserFilter(filterItem.id)}
                    style={{ background: userFilter === filterItem.id ? '#6366f1' : 'transparent', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  >
                    {filterItem.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <Users size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>No client accounts found matching current query parameters.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredUsers.map(u => {
                  const parentShop = u.role === 'staff' ? shops.find(s => s.id === u.staff_of) : null;
                  return (
                    <div key={u.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px 20px', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>👤 {u.name}</h4>
                          <span style={{
                            ...styles.badge, 
                            background: u.role === 'distributor' ? 'rgba(167, 139, 250, 0.15)' : u.role === 'staff' ? 'rgba(245, 158, 11, 0.15)' : u.role === 'ca' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(99, 102, 241, 0.15)', 
                            color: u.role === 'distributor' ? '#c084fc' : u.role === 'staff' ? '#fbbf24' : u.role === 'ca' ? '#22d3ee' : '#818cf8'
                          }}>
                            {u.role}
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span>📞 Phone: {u.phone}</span>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                          <span>Status: {u.status}</span>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }} onClick={() => togglePINReveal(u.id)}>
                            {revealedPINs[u.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                            <span>PIN/Pass: <b>{revealedPINs[u.id] ? (u.pass || '1234') : '••••'}</b></span>
                          </span>
                          {parentShop && (
                            <>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}></span>
                              <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>🛒 Helper of: {parentShop.name}</span>
                            </>
                          )}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setResetModal({ show: true, userId: u.id, userName: u.name, newPass: '' })} style={{...styles.actionBtn, background: 'transparent', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', padding: '6px 12px', borderRadius: '8px' }}>
                          🔑 Access Key
                        </button>
                        <button onClick={() => handleDelete(u.id)} style={{...styles.actionBtn, background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '6px 12px', borderRadius: '8px' }}>
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ===== REVENUE ANALYTICS TAB CONTENT ===== */}
        {activeTab === 'payments' && (
          <div style={styles.glassCard}>
            
            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 900 }}>SaaS Revenue Analytics</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94a3b8' }}>Real-time subscription billing logs and outstanding balances</p>

            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '24px', borderRadius: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', justifyItems: 'center', marginBottom: '32px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>ARR (Annual Recurring Revenue)</span>
                <div style={{ fontSize: '48px', fontWeight: 950, color: '#10b981', letterSpacing: '-0.04em', margin: '4px 0' }}>{stats.revenue}</div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>Based on premium SaaS pricing models for onboarded shops.</p>
              </div>
              
              <div style={{ flex: 1, borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', borderTop: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingLeft: isMobile ? '0' : '24px', paddingTop: isMobile ? '24px' : '0' }}>
                <span style={{ fontSize: '13px', color: '#cbd5e1', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Premium Conversions Performance</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                  {stats.paidShops} / {stats.totalShops} Shops Converted ({stats.totalShops > 0 ? Math.round((stats.paidShops / stats.totalShops) * 100) : 0}%)
                </div>
                
                {/* Visual Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.totalShops > 0 ? (stats.paidShops / stats.totalShops) * 100 : 0}%`, background: 'linear-gradient(to right, #10b981, #3b82f6)', borderRadius: '10px' }}></div>
                </div>
              </div>
            </div>

            {/* SaaS Plan Configurator Workspace */}
            <div style={{ marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>💼 Dynamic SaaS Subscription Tiers</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Create, update, and manage pricing plan models active on the platform</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingPlan({ id: '', name: '', price: '', description: '', features: [] });
                    setShowPlanModal(true);
                  }}
                  style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}
                >
                  <PlusCircle size={14} /> Add SaaS Tier
                </button>
              </div>

              {plans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  No plans configured. Click "Add SaaS Tier" to create one.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
                  {plans.map(plan => (
                    <div key={plan.id} style={{ ...styles.glassCard, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px', padding: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ ...styles.badge, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>{plan.id.toUpperCase()}</span>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>₹{plan.price}<span style={{ fontSize: '12px', color: '#94a3b8' }}>/mo</span></div>
                        </div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>{plan.name}</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>{plan.description}</p>
                        
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '16px' }}>
                          <strong style={{ display: 'block', marginBottom: '6px', color: '#fff' }}>Features:</strong>
                          <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                            {(plan.features || []).slice(0, 3).map((feat, idx) => (
                              <li key={idx} style={{ marginBottom: '4px' }}>{feat}</li>
                            ))}
                            {(plan.features || []).length > 3 && (
                              <li style={{ color: '#818cf8', listStyleType: 'none', marginLeft: '-16px', marginTop: '6px' }}>+ {(plan.features || []).length - 3} more features</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                        <button 
                          onClick={() => {
                            setEditingPlan(plan);
                            setShowPlanModal(true);
                          }} 
                          style={{ ...styles.actionBtn, flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px', justifyContent: 'center' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)} 
                          style={{ ...styles.actionBtn, flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '6px', justifyContent: 'center' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List */}
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>Premium Subscription Ledger</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shops.map(shop => {
                const activePlan = plans.find(p => p.id === shop.subscription);
                return (
                  <div key={shop.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>🛒 {shop.name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>📞 {shop.phone}</p>
                    </div>
                    <div>
                      {activePlan ? (
                        <span style={{ ...styles.badge, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>✓ Paid {activePlan.name} (₹{activePlan.price}/mo)</span>
                      ) : shop.subscription === 'active' ? (
                        <span style={{ ...styles.badge, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>✓ Paid Premium PRO (₹999/mo)</span>
                      ) : (
                        <span style={{ ...styles.badge, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>Free Trial Node</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ===== SYSTEM SETTINGS TAB CONTENT ===== */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* API Settings */}
            <div style={styles.glassCard}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#fff', fontWeight: 800 }}>🔑 Payment Gateway Configuration</h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '20px', lineHeight: '1.5' }}>
                Enter your merchant **Razorpay Key ID** here. This key will be dynamically injected into the Shopkeeper dashboards so they can securely checkout their ₹999 PRO subscription directly to your official account.
              </p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razorpay Key ID (Live / Sandbox)</label>
                <input 
                  type="text" value={razorpayKey} onChange={e => setRazorpayKey(e.target.value)} 
                  placeholder="e.g. rzp_live_xxxxxxxxxxx" 
                  style={styles.input} 
                />
              </div>
              
              <button onClick={handleSaveSettings} style={{...styles.actionBtn, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', padding: '14px', width: '100%', justifyContent: 'center', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.25)' }}>
                💾 Commit API Configuration
              </button>
            </div>

            {/* Platform Integrity Summary */}
            <div style={styles.glassCard}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', fontWeight: 800 }}>📊 Platform Diagnostics</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
                  <span>Database Nodes Registered:</span>
                  <b style={{ color: '#fff' }}>{allUsers.length} total users</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
                  <span>Tenant Segment Audit:</span>
                  <span>
                    <b style={{color: '#818cf8'}}>{stats.totalShops} shops</b> • 
                    <b style={{color: '#fbbf24', marginLeft: '6px'}}>{stats.totalUsers} customers</b> • 
                    <b style={{color: '#c084fc', marginLeft: '6px'}}>{stats.totalDistributors} distributors</b>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
                  <span>Gatekeeper Verification Status:</span>
                  <b style={{color: pendingUsers.length > 0 ? '#ef4444' : '#10b981'}}>{pendingUsers.length > 0 ? '⚠️ Pending Approvals' : '✓ Standard Secure'}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
                  <span>Active Credit Outstanding:</span>
                  <b style={{color: '#ef4444'}}>₹{stats.activeCredit}</b>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===== CMS TAB CONTENT ===== */}
        {activeTab === 'cms' && (
          <div style={styles.glassCard}>
            <AdminCMS />
          </div>
        )}

        {/* ===== GLOBAL CREDITS TAB CONTENT ===== */}
        {activeTab === 'credits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Aggregate Credits Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={{...styles.glassCard, borderTop: '4px solid #ef4444'}}>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 'bold' }}>Global Outstanding Credit</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#f87171', letterSpacing: '-0.02em', margin: '6px 0' }}>₹{stats.activeCredit}</div>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Total outstanding wholesale and supplier invoices.</p>
              </div>
              <div style={{...styles.glassCard, borderTop: '4px solid #10b981'}}>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 'bold' }}>Credit Transactions</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em', margin: '6px 0' }}>{globalCredits.length} Vouchers</div>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Outstanding or paid supply logs across database.</p>
              </div>
              <div style={{...styles.glassCard, borderTop: '4px solid #6366f1'}}>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 'bold' }}>System Sales Returns</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#818cf8', letterSpacing: '-0.02em', margin: '6px 0' }}>
                  {globalOrders.filter(o => o.status === 'Returned').length} Returns
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Sales invoices refunded and stock restored.</p>
              </div>
            </div>

            {/* Credit Ledger and Returns lists */}
            <div style={styles.glassCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Distributor Credit & Supply Registry</h3>
                <button onClick={() => downloadCSV(globalCredits, 'distributor_credits_registry')} style={{...styles.actionBtn, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                  <Download size={13} /> Export Credits CSV
                </button>
              </div>

              {globalCredits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <FileText size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ margin: 0 }}>No distributor credit records exist on MyStore OS.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {globalCredits.map(c => (
                    <div key={c.id} style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>₹{c.amount}</h4>
                          {c.paid ? (
                            <span style={{...styles.badge, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981'}}>✓ Settled</span>
                          ) : (
                            <span style={{...styles.badge, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171'}}>Outstanding</span>
                          )}
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                          <b>From:</b> {c.fromName} (Distributor) ➔ <b>To Shop:</b> {c.toName}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>
                          Description: {c.desc || 'No particulars entered'}
                        </p>
                      </div>
                      
                      {!c.paid && (
                        <button onClick={() => handleSettleCredit(c.id)} style={{...styles.actionBtn, background: '#10b981', color: '#fff', padding: '8px 16px' }}>
                          ✓ Settle Vouchers
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales Return logs card */}
            <div style={styles.glassCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Global Sales & Invoice Returns Log</h3>
                <button onClick={() => downloadCSV(globalOrders, 'system_sales_registry')} style={{...styles.actionBtn, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                  <Download size={13} /> Export Invoices CSV
                </button>
              </div>

              {globalOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <FileText size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ margin: 0 }}>No billing transactions registered on the platform.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {globalOrders.slice(0, 10).map(o => (
                    <div key={o.id} style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>Bill Total: ₹{o.total}</span>
                          {o.status === 'Returned' ? (
                            <span style={{...styles.badge, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171'}}>↩ Returned / Refunded</span>
                          ) : (
                            <span style={{...styles.badge, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981'}}>{o.status || 'Accepted'}</span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                          🏪 Store: <b>{o.shopName}</b> • Shopper: <b>{o.userName}</b>
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                          📅 Date: {new Date(o.date).toLocaleString()}
                        </p>
                      </div>
                      
                      <div style={{ fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', color: '#cbd5e1' }}>
                        {Array.isArray(o.items) ? `${o.items.length} items logged` : '0 items'}
                      </div>
                    </div>
                  ))}
                  {globalOrders.length > 10 && (
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '8px' }}>
                      Showing latest 10 transactions. Export as spreadsheet to audit all {globalOrders.length} entries.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ===== MOBILE FLOATING NAV DOCK ===== */}
      {isMobile && (
        <div style={styles.mobileNav}>
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Stats' },
            { id: 'shops', icon: <Store size={20} />, label: 'Shops' },
            { id: 'customers', icon: <Users size={20} />, label: 'Users' },
            { id: 'credits', icon: <FileText size={20} />, label: 'Credits' },
            { id: 'payments', icon: <CreditCard size={20} />, label: 'Revenue' },
            { id: 'cms', icon: <Globe size={20} />, label: 'CMS' },
            { id: 'settings', icon: <Settings size={20} />, label: 'System' }
          ].map(tab => (
            <div 
              key={tab.id} 
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }} 
              style={{ textAlign: 'center', color: activeTab === tab.id ? '#818cf8' : 'rgba(255,255,255,0.45)', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center' }}
            >
              <div style={{ marginBottom: '2px' }}>{tab.icon}</div>
              <span style={{ fontSize: '10px', fontWeight: 700 }}>{tab.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== REUSABLE ENTERPRISE GLASS MODAL (RESET ACCESS KEY) ===== */}
      {resetModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(3, 4, 8, 0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(16px)' }}>
          <div style={{...styles.glassCard, width: '100%', maxWidth: '420px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'linear-gradient(135deg, #0e1224 0%, #05060b 100%)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>Provision New Access Key</h3>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
              You are updating the access credential password for tenant <b>{resetModal.userName}</b>. This will instantly invalidate their previous password.
            </p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Access Password</label>
              <input 
                type="text" 
                placeholder="Minimum 4 alpha-numeric keys..." 
                value={resetModal.newPass} 
                onChange={e => setResetModal({ ...resetModal, newPass: e.target.value })} 
                style={styles.input} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setResetModal({ show: false, userId: null, userName: '', newPass: '' })} style={{...styles.actionBtn, flex: 1, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center' }}>
                Abort
              </button>
              <button onClick={handleResetPasswordSubmit} style={{...styles.actionBtn, flex: 1, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000', justifyContent: 'center', boxShadow: '0 8px 16px rgba(245, 158, 11, 0.2)' }}>
                Commit Credentials
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===== SAAS PLAN CONFIGURATOR GLASS MODAL ===== */}
      {showPlanModal && editingPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(3, 4, 8, 0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(16px)' }}>
          <div style={{ ...styles.glassCard, width: '100%', maxWidth: '500px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'linear-gradient(135deg, #0e1224 0%, #05060b 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlusCircle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                {plans.some(p => p.id === editingPlan.id) ? 'Edit SaaS Tier' : 'Create SaaS Tier'}
              </h3>
            </div>

            <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Plan Unique ID</label>
                <input 
                  type="text" 
                  disabled={plans.some(p => p.id === editingPlan.id)} 
                  placeholder="e.g. enterprise_plus" 
                  value={editingPlan.id} 
                  onChange={e => setEditingPlan({ ...editingPlan, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })} 
                  style={styles.input} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Plan Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Enterprise Premium Plus" 
                  value={editingPlan.name} 
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} 
                  style={styles.input} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Price (INR / Month)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 1999" 
                  value={editingPlan.price} 
                  onChange={e => setEditingPlan({ ...editingPlan, price: e.target.value })} 
                  style={styles.input} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Description</label>
                <textarea 
                  placeholder="Summarize target audience and plan tier..." 
                  value={editingPlan.description} 
                  onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} 
                  style={{ ...styles.input, minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Features Checklist</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Add plan capability feature..." 
                    value={newFeature} 
                    onChange={e => setNewFeature(e.target.value)} 
                    style={styles.input} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                  />
                  <button type="button" onClick={handleAddFeature} style={{ ...styles.actionBtn, background: '#6366f1', color: 'white' }}>
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                  {(editingPlan.features || []).map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px' }}>
                      <span>{feat}</span>
                      <button type="button" onClick={() => handleRemoveFeature(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                  {(editingPlan.features || []).length === 0 && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>No features added yet.</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setShowPlanModal(false); setEditingPlan(null); }} style={{ ...styles.actionBtn, flex: 1, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" style={{ ...styles.actionBtn, flex: 1, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', justifyContent: 'center', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}>
                  Save Plan
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
