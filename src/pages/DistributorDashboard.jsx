import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { safe, mustSucceed } from '../lib/asyncHelpers';
import NotificationCenter from '../components/NotificationCenter';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDistCaps, hasDistCap } from '../lib/features';
import {
  BarChart3,
  Building2,
  ShoppingBag,
  Layers,
  History,
  Bell,
  LogOut,
  Plus,
  Lock,
  TrendingUp,
  Map,
  Settings
} from 'lucide-react';


// Mobile stock order card — its own component (rather than inline in a
// .map()) specifically so each card gets its own independent
// "expected dispatch date" input. Multiple pending orders can be on
// screen at once; a single shared date field would leak one order's
// chosen date into every other card.
function StockOrderCard({ order: o, badge, selected, onToggleSelect, onAccept, onReject, onDispatch }) {
  const [dateInput, setDateInput] = useState('');
  return (
    <div style={{ background: '#FFFFFF', border: selected ? '1px solid #4F46E5' : '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {o.status === 'accepted' && (
          <input type="checkbox" checked={selected} onChange={onToggleSelect} style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{o.shopName}</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{new Date(o.date).toLocaleDateString()} {new Date(o.date).toLocaleTimeString()}</p>
              {o.status === 'accepted' && o.expectedDispatchDate && (
                <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700, marginTop: 3 }}>
                  🕓 Expected: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              )}
              {o.status === 'dispatched' && o.dispatchedAt && (
                <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, marginTop: 3 }}>
                  📦 Dispatched {new Date(o.dispatchedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '10px', background: badge.bg, color: badge.color,
                padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'capitalize'
              }}>{badge.label}</span>
              <h4 style={{ fontSize: '16px', margin: '4px 0 0 0', color: '#2563EB' }}>₹{o.total}</h4>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '8px 0', margin: '8px 0' }}>
            {o.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', margin: '4px 0' }}>
                <span>{item.name}</span>
                <span>x{item.qty} (₹{item.price * item.qty})</span>
              </div>
            ))}
          </div>

          {o.status === 'pending' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Expected dispatch date (optional)</label>
              <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onAccept(dateInput)} style={{ flex: 1, background: '#16A34A', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                  Accept & Credit
                </button>
                <button onClick={onReject} style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                  Reject
                </button>
              </div>
            </div>
          )}

          {o.status === 'accepted' && (
            <button onClick={onDispatch} style={{ width: '100%', marginTop: 10, background: '#4F46E5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              📦 Mark as Dispatched
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DistributorDashboard = () => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const { isOnline, pendingCount } = useOfflineSync();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [credits, setCredits] = useState([]);
  const [shops, setShops] = useState([]);
  const [shopCodeInput, setShopCodeInput] = useState('');
  const [shopLinkBusy, setShopLinkBusy] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [distCycle, setDistCycle] = useState('monthly');
  
  // Stock Orders & Wholesale Catalog states
  const [stockOrders, setStockOrders] = useState([]);
  const [wholesaleProducts, setWholesaleProducts] = useState([]);

  // Distributor business profile / GST settings
  const [profileForm, setProfileForm] = useState({ name: '', gstin: '', stateCode: '', businessAddress: '', upiId: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  useEffect(() => {
    if (user) setProfileForm({
      name: user.name || '',
      gstin: user.gstin || '',
      stateCode: user.stateCode || '',
      businessAddress: user.businessAddress || '',
      upiId: user.upiId || '',
    });
  }, [user]);
  const saveDistributorProfile = async () => {
    setProfileSaving(true);
    try {
      await api.updateProfile(user.id, {
        name: profileForm.name,
        gstin: profileForm.gstin,
        stateCode: profileForm.stateCode,
        businessAddress: profileForm.businessAddress,
        upiId: profileForm.upiId,
      });
      toast.success('Business profile saved');
    } catch (e) {
      toast.error('Could not save: ' + (e?.message || 'unknown error'));
    } finally {
      setProfileSaving(false);
    }
  };
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

  // Distributor subscription plan state
  const [distPlans, setDistPlans] = useState([]);
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });

  // Responsive state & Widescreen helpers
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Dispatch scheduling — accept an order without implying same-day
  // shipment, then batch multiple accepted orders into one dispatch
  // once a delivery route is actually worth sending a vehicle for.
  const [dispatchDateInput, setDispatchDateInput] = useState('');
  const [selectedForDispatch, setSelectedForDispatch] = useState(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [visitedShops, setVisitedShops] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dist_visited') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (stockOrders && stockOrders.length > 0 && !selectedOrder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrder(stockOrders[0]);
    }
  }, [stockOrders, selectedOrder]);

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
    setCredits(await safe(() => api.getDistCredits(user.id)));
    setShops(await safe(() => api.getMyRetailShops(user.id)));
    setStockOrders(await safe(() => api.getDistributorOrders(user.id)));
    setWholesaleProducts(await safe(() => api.getDistributorProducts()));
    setDistPlans(await safe(() => api.getDistributorSubscriptionPlans()));
    setPricing(await safe(() => api.getPricing()));
    const settings = await safe(() => api.getSettings());
    setSysSettings(settings);
  }, [user.id]);

  const handleLinkShop = async () => {
    setShopLinkBusy(true);
    try {
      const res = await api.linkByPublicCode(user.id, 'distributor', shopCodeInput);
      setShopCodeInput('');
      setShops(await safe(() => api.getMyRetailShops(user.id)));
      toast.success(`Linked with shop ${res.name}`);
    } catch (ex) {
      toast.error(ex.message || 'Could not link.');
    } finally {
      setShopLinkBusy(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Was completely unfiltered — every distributor's dashboard refetched
  // on ANY distributor's order changing anywhere on the platform, not
  // just their own. Not a data leak (loadData already correctly scopes
  // its own fetch to this distributor via getDistributorOrders), but
  // genuinely not "one to one": wasteful refetches and UI flicker for
  // events that have nothing to do with this session.
  useRealtimeTable({ table: 'stock_orders', filter: `distributor_id=eq.${user.id}`, onRefresh: loadData });
  useRealtimeTable({ table: 'credits', filter: `from_id=eq.${user.id}`, onRefresh: loadData });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGiveCredit = async () => {
    if(!selectedShop || !amount) return toast.error("Select shop and amount");
    await mustSucceed(() => api.addCredit(user.id, selectedShop, desc || 'FMCG Stock Supply', amount), 'Add credit');
    toast.success("Credit added to shop successfully!");
    setShowModal(false);
    setSelectedShop('');
    setDesc('');
    setAmount('');
    loadData();
  };

  const markPaid = async (creditId) => {
    await mustSucceed(() => api.markCreditPaid(creditId), 'Mark credit paid');
    toast.success("Payment Received & Cleared!");
    loadData();
  };

  const handleAddWholesaleProduct = async () => {
    if (!newProdName || !newProdPrice || !newProdStock) return toast.error("Enter product name, price and stock");
    await mustSucceed(() => api.addDistributorProduct({
      distributorId: user.id,
      name: newProdName,
      price: newProdPrice,
      stock: newProdStock,
      category: newProdCategory
    }), 'Publish product');
    toast.success("Product published to wholesale catalog!");
    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('');
    setShowCatalogModal(false);
    loadData();
  };

  const handleUpdateStockOrder = async (orderId, status, expectedDate) => {
    await mustSucceed(() => api.updateStockOrderStatus(orderId, status, user.id, expectedDate || null), 'Update order status');
    toast.success(
      status === 'accepted' && expectedDate
        ? `Accepted — expected dispatch ${new Date(expectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
        : `Restock order marked as ${status}!`
    );
    setDispatchDateInput('');
    loadData();
  };

  // Bulk-dispatch every accepted order the distributor has ticked — the
  // real "route is full, send it all" action. One tap covers the whole
  // batch instead of clicking Dispatch per order. Also usable for a
  // single order (pass its id directly) from the detail panel's
  // 'Mark as Dispatched' button, so there's one code path for both.
  const handleDispatchSelected = async (singleOrderId) => {
    const ids = singleOrderId ? [singleOrderId] : [...selectedForDispatch];
    if (ids.length === 0) return;
    setDispatching(true);
    try {
      const res = await api.dispatchStockOrders(ids);
      const n = res?.dispatched || 0;
      toast.success(n > 0 ? `${n} order${n === 1 ? '' : 's'} dispatched!` : 'Nothing to dispatch — selection may be stale.');
      setSelectedForDispatch(new Set());
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to dispatch selected orders');
    }
    setDispatching(false);
  };

  const toggleDispatchSelect = (orderId) => {
    setSelectedForDispatch(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  // Was a 3-way ternary (pending/accepted/else-red) that silently
  // treated a 'dispatched' order the same as 'rejected' — wrong colour,
  // wrong label. Proper lookup covering all four real states now.
  const STOCK_ORDER_BADGE = {
    pending:    { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
    accepted:   { bg: '#DCFCE7', color: '#15803D', label: 'Accepted' },
    dispatched: { bg: '#DBEAFE', color: '#1D4ED8', label: '📦 Dispatched' },
    rejected:   { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
  };

  const handleDistSubscribe = async (plan) => {
    if (!plan) return;
    if (!sysSettings.razorpayKey) return toast.error("Payment gateway not configured yet.");
    const cycle = distCycle;
    const pr = pricing ? api.computePrice(pricing, plan.id, cycle) : null;
    const payPlanId = cycle === 'monthly' ? plan.id : `${plan.id}_${cycle}`;
    const payPrice = pr?.final || plan.price;
    let orderId = null;
    try {
      const orderData = await api.createRazorpayOrder(payPlanId, payPrice);
      orderId = orderData?.orderId;
    } catch (_e) { orderId = null; }
    if (!orderId) {
      return toast.error('Payment could not be started securely right now. Please try again shortly.');
    }
    const options = {
      key: sysSettings.razorpayKey,
      amount: (payPrice * 100).toString(),
      currency: "INR",
      name: "MyStore OS — Distributor",
      description: `${plan.name} ${cycle !== 'monthly' ? cycle : ''}`,
      order_id: orderId,
      handler: async (response) => {
        try {
          // Was safe()-wrapped — swallowed any signature-verification
          // failure, so the handler fell straight through to a success
          // toast regardless of whether the payment actually verified.
          await mustSucceed(() => api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: payPlanId,
            userId: user.id,
          }), 'Verify payment');
          // Was calling api.updateProfile(user.id, { distributor_plan_tier,
          // subscription }) here — but distributor_plan_tier is a
          // protected billing column (see
          // 20260609_protect_subscription_columns.sql): a DB trigger
          // RAISES on any client attempt to change it directly, exactly
          // to prevent a distributor granting themselves a plan without
          // paying. That meant this line could NEVER succeed for a real
          // distributor — every real payment hit 'Not allowed to change
          // distributor plan' and fell into the catch below as "Upgrade
          // failed. Contact support," even though the money was already
          // charged and razorpay-verify-payment had already granted the
          // tier correctly server-side (with service-role, which the
          // trigger doesn't block). Fix: re-fetch the authoritative
          // profile the same way ShopDashboard's upgrade flow already
          // does, instead of trying to set the tier from the client.
          const updated = await safe(() => api.getUserById(user.id));
          if (updated) login(updated);
          toast.success(`Upgraded to ${plan.name}!`);
          setShowUpgradePlanModal(false);
          loadData();
        } catch (_e) {
          toast.error(`Upgrade failed. Contact support.`);
        }
      },
      prefill: { name: user.name, contact: user.phone || '' },
      theme: { color: "#4F46E5" }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const distCaps = getDistCaps(user);
  const totalOutstanding = credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
  const totalReceived = credits.filter(c => c.paid).reduce((a, b) => a + b.amount, 0);
  const pendingCredits = credits.filter(c => !c.paid);

  if (!isMobile) {
    const notifications = getNotifications();
    
    return (
      <div className="dashboard-wrapper-flex" style={{ background: '#F8FAFC', color: '#0F172A', minHeight: '100vh', width: '100%' }}>
        <ToastContainer theme="light" position="top-center" />

        {/* Desktop Sticky Left Sidebar */}
        <div className="desktop-glass-sidebar dark-sidebar" style={{ background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Logo & Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingLeft: '8px' }}>
            <div style={{ background: '#4F46E5', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff' }}>M</div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', color: '#FFFFFF' }}>FMCG Supply</h2>
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold' }}>DISTRIBUTOR CONSOLE</span>
            </div>
          </div>

          {/* User Profile */}
          <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Welcome back,</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFFFFF' }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: isOnline ? '#16a34a' : '#d97706', marginTop: '4px', fontWeight: 'bold' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#16a34a' : '#d97706', display: 'inline-block' }}></span>
              {isOnline ? (pendingCount > 0 ? `${pendingCount} pending sync` : 'Online') : 'Offline mode'}
            </div>
          </div>

          {/* Sidebar Tabs Nav Menu */}
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>Menu Navigation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'shops', label: 'Retail Shops', icon: Building2 },
              { id: 'orders', label: 'Incoming Orders', icon: ShoppingBag, badge: stockOrders.filter(o => o.status === 'pending').length },
              { id: 'catalog', label: 'Wholesale Catalog', icon: Layers },
              { id: 'routeplanner', label: 'Route Planner', icon: Map, locked: !hasDistCap(user, 'routePlanner') },
              { id: 'analytics', label: 'Advanced Analytics', icon: TrendingUp, locked: !hasDistCap(user, 'advancedAnalytics') },
              { id: 'history', label: 'Collection History', icon: History },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ fontSize: '13px', padding: '12px 14px', position: 'relative', opacity: tab.locked ? 0.6 : 1 }}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {tab.locked && <Lock size={11} style={{ color: '#d97706' }} />}
                  {!tab.locked && tab.badge > 0 && (
                    <span style={{ background: '#EF4444', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Notifications Quick View */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="sidebar-nav-item"
              style={{ fontSize: '13px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px', color: '#E2E8F0' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bell size={16} style={{ color: '#d97706' }} /> Alerts Log
              </span>
              {notifications.length > 0 && (
                <span style={{ background: '#4F46E5', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{notifications.length}</span>
              )}
            </button>

            <button
              onClick={() => setShowUpgradePlanModal(true)}
              className="sidebar-nav-item"
              style={{ color: '#B45309', display: 'flex', alignItems: 'center', gap: '12px', background: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: '8px' }}
            >
              <TrendingUp size={16} /> Upgrade Plan
              <span style={{ marginLeft: 'auto', fontSize: '9px', background: 'rgba(217,119,6,0.2)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>{(user.distributorPlanTier || 'basic_distributor').replace('_distributor', '').toUpperCase()}</span>
            </button>
            <button
              onClick={handleLogout}
              className="sidebar-nav-item"
              style={{ color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5' }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="fluid-dashboard-main">
          
          {/* Notifications Banner Overlay inside Desktop view */}
          {showNotifications && (
            <div className="premium-glass" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A' }}><Bell size={15} style={{ color: '#d97706' }} /> Notifications & Activity Stream</h3>
                <button onClick={() => setShowNotifications(false)} style={{ background: '#F1F5F9', border: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', width: 'auto', flexShrink: 0 }}>Dismiss</button>
              </div>
              {notifications.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', margin: 0 }}>No recent business events.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ display: 'flex', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{n.emoji}</span>
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#0F172A', fontWeight: 'bold' }}>{n.title}</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>{n.text}</p>
                        <span style={{ fontSize: '9px', color: '#64748B', display: 'block', marginTop: '4px' }}>{new Date(n.date).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shop limit upgrade banner */}
          {distCaps.maxShops !== -1 && shops.length > distCaps.maxShops && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#B45309', fontWeight: '500' }}>
                ⚠️ You have {shops.length} shops but your plan allows {distCaps.maxShops}. Upgrade to continue serving all shops.
              </p>
              <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#D97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Upgrade Now
              </button>
            </div>
          )}

          {/* ================= DASHBOARD TAB ================= */}
          {activeTab === 'dashboard' && (
            <div className="responsive-split-grid" style={{ width: '100%' }}>
              {/* Left Column: Stats overview + Circular Collection Guage */}
              <div>
                <div className="premium-glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Active Market Outstanding</span>
                  <h2 style={{ fontSize: '48px', fontWeight: '900', color: '#DC2626', margin: '10px 0 20px 0', letterSpacing: '-1px' }}>₹{totalOutstanding}</h2>
                  
                  {/* Gauge */}
                  <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '24px' }}>
                    <svg width="160" height="160" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="60" cy="60" r="50" fill="transparent" stroke="#F1F5F9" strokeWidth="6" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="transparent"
                        stroke="#10B981"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={2 * Math.PI * 50 * (1 - (totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) : 0))}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A' }}>
                        {Math.round(totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) * 100 : 0)}%
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>Collected</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', borderTop: '1px solid #E2E8F0', paddingTop: '20px', gap: '16px' }}>
                    <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' }}>Revenue Collected</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>₹{totalReceived}</div>
                    </div>
                    <div style={{ paddingLeft: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' }}>Linked Retailers</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{shops.length} shops</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowModal(true)} 
                  style={{ width: '100%', background: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.2)' }}
                >
                  <Plus size={18} /> + Supply Wholesale Stock (Extend Credit)
                </button>
              </div>

              {/* Right Column: Pending Collection Ledgers */}
              <div>
                <div className="premium-glass" style={{ padding: '20px', minHeight: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A' }}>
                    Outstanding Credit Balances ({pendingCredits.length})
                  </h3>
                  
                  {pendingCredits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748B' }}>
                      
                      <p style={{ margin: '12px 0 0 0', fontSize: '13px' }}>All store credits have been fully cleared!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }} className="custom-scroll">
                      {pendingCredits.map(c => (
                        <div key={c.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                              <h4 style={{ fontSize: '14px', margin: 0, color: '#0F172A', fontWeight: 'bold' }}>{c.shopName}</h4>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>{new Date(c.date).toLocaleDateString()} • {c.desc}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '16px', fontWeight: '800', color: '#DC2626' }}>₹{c.amount}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => markPaid(c.id)}
                            style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            Mark Received Cash
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= SHOPS TAB ================= */}
          {activeTab === 'shops' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#0F172A' }}>Your Retail Shops ({shops.length})</h2>

              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                {user?.publicCode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '11px' }}>Your distributor code (share with shops)</div>
                      <div style={{ color: '#0F172A', fontSize: '16px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace' }}>{user.publicCode}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard?.writeText(user.publicCode); toast.success('Code copied!'); }}
                      style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={shopCodeInput} onChange={e => setShopCodeInput(e.target.value.toUpperCase())}
                    placeholder="Add a shop by code (SHP-XXXXXX)"
                    style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  <button onClick={handleLinkShop} disabled={shopLinkBusy}
                    style={{ background: '#16a34a', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                    {shopLinkBusy ? '...' : 'Add'}
                  </button>
                </div>
              </div>
              {shops.length === 0 ? (
                <p style={{ color: '#64748B', textAlign: 'center', lineHeight: 1.6, padding: '20px' }}>
                  No shops yet. Shops appear here once they place a wholesale order from your catalog.
                  Publish products in your Wholesale Catalog so nearby shops can find and order from you.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {shops.map(shop => {
                    const shopCredits = credits.filter(c => c.toShopId === shop.id && !c.paid);
                    const owed = shopCredits.reduce((a, b) => a + b.amount, 0);
                    return (
                      <div key={shop.id} className="premium-glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#FFFFFF' }}>🏪</div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: 'bold' }}>{shop.name}</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{shop.phone}</p>
                          </div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '12px', color: '#475569' }}>Total Outstanding Credit:</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= ORDERS TAB ================= */}
          {activeTab === 'orders' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#0F172A' }}>📥 Incoming Restock Orders ({stockOrders.length})</h2>
              
              {stockOrders.length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <ShoppingBag size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No wholesale stock orders received yet from retailers.</p>
                </div>
              ) : (
                <div className="responsive-split-grid" style={{ width: '100%' }}>
                  {/* Left Column: Orders list */}
                  <div>
                    {/* Bulk dispatch bar — appears once at least one
                        accepted order is ticked. This is the actual
                        "route is full, send it all" action. */}
                    {selectedForDispatch.size > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{selectedForDispatch.size} order{selectedForDispatch.size === 1 ? '' : 's'} selected</span>
                        <button onClick={() => handleDispatchSelected()} disabled={dispatching}
                          style={{ background: dispatching ? '#94A3B8' : '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer', width: 'auto' }}>
                          {dispatching ? 'Dispatching…' : `📦 Dispatch Selected (${selectedForDispatch.size})`}
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }} className="custom-scroll">
                      {stockOrders.map(o => {
                        const badge = STOCK_ORDER_BADGE[o.status] || STOCK_ORDER_BADGE.pending;
                        return (
                        <div 
                          key={o.id} 
                          onClick={() => setSelectedOrder(o)}
                          className="premium-glass" 
                          style={{ 
                            padding: '16px', 
                            cursor: 'pointer', 
                            border: selectedOrder?.id === o.id ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                            background: selectedOrder?.id === o.id ? '#EEF2FF' : '#FFFFFF',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                          }}
                        >
                          {o.status === 'accepted' && (
                            <input type="checkbox" checked={selectedForDispatch.has(o.id)}
                              onClick={e => e.stopPropagation()}
                              onChange={() => toggleDispatchSelect(o.id)}
                              style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{o.shopName}</h4>
                                <span style={{ fontSize: '11px', color: '#475569' }}>{new Date(o.date).toLocaleDateString()}</span>
                                {o.status === 'accepted' && o.expectedDispatchDate && (
                                  <div style={{ fontSize: 10, color: '#4F46E5', fontWeight: 700, marginTop: 2 }}>
                                    🕓 Expected: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{
                                  fontSize: '9px',
                                  background: badge.bg,
                                  color: badge.color,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase'
                                }}>{badge.label}</span>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>₹{o.total}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Order Details Split panel */}
                  <div>
                    {selectedOrder ? (
                      <div className="premium-glass" style={{ padding: '20px', position: 'sticky', top: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '16px' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: '#2563EB', fontWeight: 'bold', textTransform: 'uppercase' }}>Selected Voucher</span>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0', color: '#0F172A' }}>{selectedOrder.shopName}</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>Order ID: #{selectedOrder.id.substring(0, 8)}</p>
                          </div>
                          <span style={{
                            fontSize: '10px',
                            background: selectedOrder.status === 'pending' ? '#FEF3C7' : selectedOrder.status === 'accepted' ? '#DCFCE7' : '#FEE2E2',
                            color: selectedOrder.status === 'pending' ? '#B45309' : selectedOrder.status === 'accepted' ? '#15803D' : '#B91C1C',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>{selectedOrder.status}</span>
                        </div>

                        {/* Items list */}
                        <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Itemized Ledger</span>
                          <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="custom-scroll">
                            {selectedOrder.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '13px' }}>
                                <span style={{ color: '#0F172A' }}>{item.name} <strong style={{ color: '#2563EB' }}>x{item.qty}</strong></span>
                                <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{item.price * item.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', color: '#0F172A', borderTop: '2px dashed #E2E8F0', paddingTop: '14px', marginBottom: '20px' }}>
                          <span>Order Total Value:</span>
                          <span>₹{selectedOrder.total}</span>
                        </div>

                        {selectedOrder.status === 'pending' && (
                          <div>
                            {/* Optional expected dispatch date — accepting
                                doesn't have to mean shipping today. Lets a
                                distributor commit to fulfilling an order
                                while being honest about when their route
                                to that area will actually go out. */}
                            <div style={{ marginBottom: 12 }}>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Expected dispatch date (optional)</label>
                              <input type="date" value={dispatchDateInput} onChange={e => setDispatchDateInput(e.target.value)}
                                min={new Date().toISOString().slice(0, 10)}
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button 
                                onClick={() => handleUpdateStockOrder(selectedOrder.id, 'accepted', dispatchDateInput)}
                                style={{ flex: 1, background: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}
                              >
                                Accept & Ship Credit
                              </button>
                              <button 
                                onClick={() => handleUpdateStockOrder(selectedOrder.id, 'rejected')}
                                style={{ flex: 1, background: '#EF4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                              >
                                Reject Order
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'accepted' && (
                          <div>
                            {selectedOrder.expectedDispatchDate && (
                              <p style={{ fontSize: 12, color: '#4F46E5', fontWeight: 700, marginBottom: 10 }}>
                                🕓 Expected dispatch: {new Date(selectedOrder.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                            <button
                              onClick={() => handleDispatchSelected(selectedOrder.id)}
                              style={{ width: '100%', background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(79,70,229,0.25)' }}
                            >
                              📦 Mark as Dispatched
                            </button>
                            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>
                              Tip: tick multiple accepted orders in the list on the left to dispatch a whole route together.
                            </p>
                          </div>
                        )}

                        {selectedOrder.status === 'dispatched' && selectedOrder.dispatchedAt && (
                          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>
                              📦 Dispatched {new Date(selectedOrder.dispatchedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="premium-glass" style={{ padding: '30px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        Select an order from the ledger to manage its fulfillment.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= CATALOG TAB ================= */}
          {activeTab === 'catalog' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Distributor Wholesale Catalog ({wholesaleProducts.length})</h2>
                <button 
                  onClick={() => setShowCatalogModal(true)}
                  style={{ background: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', width: 'auto', border: 'none', cursor: 'pointer' }}
                >
                  <Plus size={16} /> Publish Wholesale Product
                </button>
              </div>

              {wholesaleProducts.length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <Layers size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No products published in the distributor catalog.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                  {wholesaleProducts.map(p => (
                    <div key={p.id} className="premium-glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                      <div>
                        <span style={{ fontSize: '9px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold', border: '1px solid #BFDBFE' }}>{p.category}</span>
                        <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{p.name}</h4>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>₹{p.price}</span>
                        <span style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>Stock: {p.stock} cases</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= ROUTE PLANNER TAB ================= */}
          {activeTab === 'routeplanner' && (
            <div>
              {!hasDistCap(user, 'routePlanner') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '20px' }}>
                  <Lock size={40} style={{ color: '#D97706', marginBottom: '16px' }} />
                  <h3 style={{ color: '#B45309', margin: '0 0 8px 0', fontWeight: '800' }}>Route Planner — Pro Distributor Feature</h3>
                  <p style={{ color: '#B45309', fontSize: '13px', margin: '0 0 24px 0' }}>Optimise your daily delivery route based on outstanding credit and shop distance.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#F59E0B', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#0F172A' }}>🗺️ Route Planner</h2>
                  {(() => {
                    const today = new Date();
                    const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 7);
                    const routeShops = [...shops].sort((a, b) => {
                      const aOwed = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bOwed = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const aPending = stockOrders.filter(o => o.shopId === a.id && o.status === 'pending').length;
                      const bPending = stockOrders.filter(o => o.shopId === b.id && o.status === 'pending').length;
                      const aLastVisit = visitedShops[a.id] ? new Date(visitedShops[a.id]) : null;
                      const bLastVisit = visitedShops[b.id] ? new Date(visitedShops[b.id]) : null;
                      const aNotVisited = !aLastVisit || aLastVisit < sevenAgo ? 1 : 0;
                      const bNotVisited = !bLastVisit || bLastVisit < sevenAgo ? 1 : 0;
                      return (bOwed + bPending * 100 + bNotVisited * 50) - (aOwed + aPending * 100 + aNotVisited * 50);
                    });
                    const totalToCollect = routeShops.reduce((s, sh) => s + credits.filter(c => c.toShopId === sh.id && !c.paid).reduce((a, c) => a + c.amount, 0), 0);
                    const markVisited = (shopId) => {
                      const updated = { ...visitedShops, [shopId]: new Date().toISOString() };
                      setVisitedShops(updated);
                      try { localStorage.setItem('dist_visited', JSON.stringify(updated)); } catch (_e) { /* ignore */ }
                    };
                    return (
                      <>
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: '#4F46E5', fontSize: '14px', fontWeight: '700' }}>Today's Route: {routeShops.length} shops</span>
                          <span style={{ color: '#B91C1C', fontSize: '14px', fontWeight: '700' }}>₹{totalToCollect.toLocaleString('en-IN')} to collect</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {routeShops.map((shop, idx) => {
                            const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                            const pendingOrders = stockOrders.filter(o => o.shopId === shop.id && o.status === 'pending').length;
                            const lastVisit = visitedShops[shop.id] ? new Date(visitedShops[shop.id]) : null;
                            const notVisited7 = !lastVisit || lastVisit < sevenAgo;
                            return (
                              <div key={shop.id} className="premium-glass" style={{ padding: '14px 18px', borderLeft: `4px solid ${owed > 5000 ? '#EF4444' : owed > 0 ? '#F59E0B' : '#10B981'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                                <div style={{ flex: 1, minWidth: '140px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>Stop #{idx + 1}</span>
                                    {notVisited7 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', fontWeight: 'bold' }}>Not visited 7d+</span>}
                                    {pendingOrders > 0 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 'bold' }}>{pendingOrders} pending</span>}
                                  </div>
                                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{shop.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                                    {shop.phone || 'No phone'} · Last: {lastVisit ? lastVisit.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: '10px', color: '#64748B' }}>outstanding</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {shop.phone && <a href={`tel:${shop.phone}`} style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>📞 Call</a>}
                                    {shop.phone && <a href={`https://wa.me/91${shop.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I am visiting your shop today for collections. Outstanding: ₹${owed}`)}`} target="_blank" rel="noreferrer" style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>💬 WA</a>}
                                    <button onClick={() => markVisited(shop.id)} style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>✓ Visited</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= ANALYTICS TAB ================= */}
          {activeTab === 'analytics' && (
            <div>
              {!hasDistCap(user, 'advancedAnalytics') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '20px' }}>
                  <TrendingUp size={40} style={{ color: '#4F46E5', marginBottom: '16px' }} />
                  <h3 style={{ color: '#3730A3', margin: '0 0 8px 0', fontWeight: '800' }}>Advanced Analytics — Pro Distributor Feature</h3>
                  <p style={{ color: '#3730A3', fontSize: '13px', margin: '0 0 24px 0' }}>Top shops, top products, GMV trends, and payment collection rates.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#0F172A' }}>📊 Advanced Analytics</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    {[
                      { label: 'Total Shops Served', value: shops.length, color: '#2563EB' },
                      { label: 'Total GMV Issued', value: `₹${credits.reduce((s, c) => s + c.amount, 0)}`, color: '#059669' },
                      { label: 'Outstanding Balance', value: `₹${totalOutstanding}`, color: '#DC2626' },
                      { label: 'Collection Rate', value: `${credits.length > 0 ? Math.round((credits.filter(c => c.paid).length / credits.length) * 100) : 0}%`, color: '#D97706' },
                    ].map((stat, i) => (
                      <div key={i} className="premium-glass" style={{ padding: '20px', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <h3 style={{ color: '#0F172A', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Top Shops by Outstanding Credit</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shops.sort((a, b) => {
                      const aO = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bO = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      return bO - aO;
                    }).slice(0, 5).map(shop => {
                      const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const total = credits.filter(c => c.toShopId === shop.id).reduce((s, c) => s + c.amount, 0);
                      const pct = total > 0 ? Math.round((owed / total) * 100) : 0;
                      return (
                        <div key={shop.id} className="premium-glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '500' }}>{shop.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '80px', height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: owed > 5000 ? '#EF4444' : '#F59E0B', borderRadius: '3px' }} />
                            </div>
                            <span style={{ color: owed > 0 ? '#DC2626' : '#15803D', fontSize: '13px', fontWeight: 'bold' }}>₹{owed}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= HISTORY TAB ================= */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Collection History & Settled Invoices</h2>
                {hasDistCap(user, 'tallyExport') ? (
                  <button
                    onClick={() => {
                      const rows = [['Date','Shop','Description','Amount','Status'], ...credits.map(c => [new Date(c.date).toLocaleDateString(), c.shopName || '', c.desc || '', c.amount, c.paid ? 'Paid' : 'Unpaid'])];
                      const csv = rows.map(r => r.join(',')).join('\n');
                      const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'distributor_tally.csv'; a.click();
                    }}
                    style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Tally Export CSV
                  </button>
                ) : (
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={11} /> Tally Export (Pro+)
                  </button>
                )}
              </div>
              
              {credits.filter(c => c.paid).length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <History size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No history of paid collections recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                  {credits.filter(c => c.paid).map(c => (
                    <div key={c.id} className="premium-glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #10B981', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: 'bold' }}>{c.shopName}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>{c.desc} • {new Date(c.date).toLocaleDateString()}</p>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>+ ₹{c.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ maxWidth: '720px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} color="#64748B" /> Business Profile & GST
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>Used on your wholesale invoices and credit records. Keep your GSTIN and address accurate for compliant billing.</p>
              </div>

              <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Name</label>
                  <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. FMCG Supply Co."
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>GSTIN</label>
                    <input value={profileForm.gstin} onChange={e => setProfileForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="e.g. 29ABCDE1234F2Z5" maxLength={15}
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.5px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>State Code</label>
                    <input value={profileForm.stateCode} onChange={e => setProfileForm(p => ({ ...p, stateCode: e.target.value }))} placeholder="e.g. 29"
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Address (printed on invoices)</label>
                  <textarea value={profileForm.businessAddress} onChange={e => setProfileForm(p => ({ ...p, businessAddress: e.target.value }))} placeholder="Warehouse / office address" rows={3}
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>UPI ID for Collections</label>
                  <input value={profileForm.upiId} onChange={e => setProfileForm(p => ({ ...p, upiId: e.target.value }))} placeholder="e.g. yourname@okhdfcbank"
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Shops paying down their credit can send to this UPI.</p>
                </div>

                <button onClick={saveDistributorProfile} disabled={profileSaving}
                  style={{ background: profileSaving ? '#A5B4FC' : '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: profileSaving ? 'default' : 'pointer', marginTop: '4px' }}>
                  {profileSaving ? 'Saving…' : 'Save Business Profile'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Upgrade Plan Modal */}
        {showUpgradePlanModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '760px', padding: '32px', background: '#FFFFFF', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0F172A' }}>Distributor Subscription Plans</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>15-day free trial on Pro Distributor plan</p>
                </div>
                <button onClick={() => setShowUpgradePlanModal(false)} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
              </div>
              {pricing && (() => {
                const cycles = ['monthly', 'quarterly', 'yearly'].filter(c => pricing.enabledCycles?.[c]);
                if (cycles.length <= 1) return null;
                const lbl = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
                const offerOn = !!pricing.offer?.enabled && Number(pricing.offer?.remaining) > 0 && Number(pricing.offer?.percent) > 0;
                return (
                  <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'inline-flex', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 10, padding: 4, gap: 4 }}>
                      {cycles.map(c => {
                        const d = c !== 'monthly' ? Number(pricing.discounts?.[c]) || 0 : 0;
                        return (
                          <button key={c} onClick={() => setDistCycle(c)} style={{ background: distCycle === c ? '#4F46E5' : 'transparent', border: 'none', color: distCycle === c ? '#fff' : '#64748B', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            {lbl[c]}{d > 0 && <span style={{ marginLeft: 5, fontSize: 10, color: distCycle === c ? '#fff' : '#16a34a', fontWeight: 800 }}>-{d}%</span>}
                          </button>
                        );
                      })}
                    </div>
                    {offerOn && distCycle !== 'monthly' && (
                      <div style={{ marginTop: 10, color: '#16a34a', fontSize: 12, fontWeight: 700 }}>🎉 Launch offer: extra {pricing.offer.percent}% OFF — {pricing.offer.remaining} slots left!</div>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                {distPlans.map(plan => {
                  const isCurrent = (user.distributorPlanTier || 'basic_distributor') === plan.id;
                  const isPro = plan.id === 'pro_distributor';
                  return (
                    <div key={plan.id} style={{ background: isPro ? '#EEF2FF' : '#FFFFFF', border: `1px solid ${isPro ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      {isPro && <div style={{ position: 'absolute', top: -12, right: 20, background: '#4F46E5', color: '#fff', fontSize: '10px', padding: '3px 10px', borderRadius: '20px', fontWeight: 800 }}>RECOMMENDED</div>}
                      <div style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{plan.name}</div>
                      {(() => {
                        const cs = { monthly: '/mo', quarterly: '/3mo', yearly: '/yr' };
                        const pr = pricing ? api.computePrice(pricing, plan.id, distCycle) : null;
                        if (pr && pr.final && distCycle !== 'monthly' && pr.final < pr.base) {
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', fontWeight: 700 }}>₹{pr.base}</span>
                                <span style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A' }}>₹{pr.final}</span>
                                <span style={{ fontSize: '13px', color: '#64748B' }}>{cs[distCycle]}</span>
                              </div>
                            </div>
                          );
                        }
                        return <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A' }}>₹{pr?.final || plan.price}<span style={{ fontSize: '13px', color: '#64748B' }}>{cs[distCycle]}</span></div>;
                      })()}
                      <p style={{ fontSize: '12px', color: '#475569', margin: '8px 0 16px 0' }}>{plan.description}</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(plan.features || []).map((f, i) => (
                          <li key={i} style={{ fontSize: '12px', color: '#0F172A', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <span style={{ color: '#10B981', marginTop: '1px' }}>✓</span>{f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>Current Plan</div>
                      ) : (
                        <button onClick={() => handleDistSubscribe(plan)} style={{ background: isPro ? '#4F46E5' : '#F1F5F9', color: isPro ? '#FFFFFF' : '#475569', border: isPro ? 'none' : '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                          {plan.id === 'pro_distributor' ? 'Start Free Trial' : 'Upgrade'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= MODALS ================= */}
        {/* Supply Stock / Add Credit Modal */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '460px', padding: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 20px 0' }}>Supply Stock on Credit</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Select Shop</label>
                <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
                  <option value="">-- Choose Shop --</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Bill Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Description / Items Supply</label>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. FMCG Stock / Atta packets" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleGiveCredit} style={{ flex: 1, background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', border: 'none', cursor: 'pointer' }}>Save Entry</button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Wholesale Product Modal */}
        {showCatalogModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '460px', padding: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 20px 0' }}>Publish Wholesale Product</h2>
              
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
                <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Rice Bag (25kg)" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Wholesale Price (₹)</label>
                  <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="850" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Available Stock</label>
                  <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="50" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category</label>
                <select value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px' }}>
                  <option value="biscuits">Biscuits & Snacks</option>
                  <option value="flour">Atta & Flours</option>
                  <option value="soaps">Soaps & Shampoos</option>
                  <option value="oil">Cooking Oils</option>
                  <option value="general">General Items</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleAddWholesaleProduct} style={{ flex: 1, background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', border: 'none', cursor: 'pointer' }}>Publish Product</button>
                <button onClick={() => setShowCatalogModal(false)} style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ================= MOBILE RETAIL CLIENT INTERFACE =================
  return (
    <div style={{ backgroundColor: '#F8FAFC', color: '#0F172A', minHeight: '100vh', paddingBottom: '80px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />
      
      {/* Header */}
      <div style={{ background: '#0F172A', padding: '20px 16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff' }}>FMCG Distributor</h1>
          <div style={{ fontSize: '12px', color: '#93c5fd' }}>{user.name} • Offline Sync Ready</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}>
            <NotificationCenter
              userId={user?.id}
              onToast={(row) => toast.info(row.title, { autoClose: 5000 })}
            />
          </div>
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
                background: '#EF4444', 
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
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto' }}>Logout</button>
        </div>
      </div>

      {/* Notifications Drawer Overlay */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: '70px', right: '16px', width: '320px', maxHeight: '450px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', zIndex: 1000, padding: '16px', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0F172A' }}>🔔 Live Notifications</h3>
            <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '13px', cursor: 'pointer', width: 'auto' }}>Close</button>
          </div>
          {getNotifications().length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '20px 0' }}>No recent notifications.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {getNotifications().map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{n.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#0F172A', fontWeight: 'bold' }}>{n.title}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>{n.text}</p>
                    {n.date && (
                      <span style={{ fontSize: '9px', color: '#64748B', display: 'block', marginTop: '4px' }}>
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
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>Total Market Outstanding</p>
              <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#DC2626', margin: '8px 0' }}>₹{totalOutstanding}</h2>
              
              {/* Circular SVG Collection progress gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) : 0))}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0F172A' }}>
                      {Math.round(totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) * 100 : 0)}%
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>Collected</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>Total Received</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803D', margin: 0 }}>₹{totalReceived}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>Active Shops</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563EB', margin: 0 }}>{shops.length}</p>
                </div>
              </div>
            </div>

            <button onClick={() => setShowModal(true)} style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', marginBottom: '24px', boxShadow: '0 4px 15px rgba(79,70,229,0.2)' }}>
              + Supply Stock (Give Credit)
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A' }}>Pending Market Collection</h3>
            {pendingCredits.length === 0 && <p style={{ color: '#64748B', textAlign: 'center' }}>No outstanding balances!</p>}
            
            {pendingCredits.map(c => (
              <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', margin: 0, color: '#0F172A' }}>{c.shopName}</h4>
                    <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0' }}>{new Date(c.date).toLocaleDateString()} • {c.desc}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ fontSize: '18px', margin: 0, color: '#DC2626' }}>₹{c.amount}</h4>
                    <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Unpaid</span>
                  </div>
                </div>
                <button onClick={() => markPaid(c.id)} style={{ width: '100%', background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
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
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A'}}>My Shops</h2>
          {shops.length === 0 ? (
            <p style={{color: '#64748B', textAlign: 'center'}}>No shops available.</p>
          ) : (
            shops.map(shop => {
              const shopCredits = credits.filter(c => c.toShopId === shop.id && !c.paid);
              const owed = shopCredits.reduce((a, b) => a + b.amount, 0);
              return (
                <div key={shop.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{shop.name}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{shop.phone}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Total Owed</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed}</div>
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
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A' }}>📥 Incoming Restock Orders</h2>
          {selectedForDispatch.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{selectedForDispatch.size} selected</span>
              <button onClick={() => handleDispatchSelected()} disabled={dispatching}
                style={{ background: dispatching ? '#94A3B8' : '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer', width: 'auto' }}>
                {dispatching ? 'Dispatching…' : `📦 Dispatch (${selectedForDispatch.size})`}
              </button>
            </div>
          )}
          {stockOrders.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center' }}>No stock orders received.</p>
          ) : (
            stockOrders.map(o => (
              <StockOrderCard
                key={o.id}
                order={o}
                badge={STOCK_ORDER_BADGE[o.status] || STOCK_ORDER_BADGE.pending}
                selected={selectedForDispatch.has(o.id)}
                onToggleSelect={() => toggleDispatchSelect(o.id)}
                onAccept={(date) => handleUpdateStockOrder(o.id, 'accepted', date)}
                onReject={() => handleUpdateStockOrder(o.id, 'rejected')}
                onDispatch={() => handleDispatchSelected(o.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0F172A' }}>Wholesale Catalog</h2>
            <button onClick={() => setShowCatalogModal(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              + Add Product
            </button>
          </div>

          {wholesaleProducts.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center' }}>No wholesale products published yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {wholesaleProducts.map(p => (
                <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '9px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold', border: '1px solid #BFDBFE' }}>{p.category}</span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{p.name}</h4>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#15803D' }}>₹{p.price}</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Stock: {p.stock}</span>
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
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A'}}>✅ Collection History</h2>
          {credits.filter(c => c.paid).length === 0 ? (
            <p style={{color: '#64748B', textAlign: 'center'}}>No history of paid collections.</p>
          ) : (
            credits.filter(c => c.paid).map(c => (
              <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #16A34A', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{c.shopName}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#15803D' }}>{c.desc} • {new Date(c.date).toLocaleDateString()}</p>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#15803D' }}>+ ₹{c.amount}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Credit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#FFFFFF', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 20px 0' }}>Supply Stock on Credit</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Select Shop</label>
              <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)} style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }}>
                <option value="">-- Choose Shop --</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Bill Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Description (Optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. 2 Cartons ITC Cigarettes" style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }} />
            </div>

            <button onClick={handleGiveCredit} style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Credit Entry</button>
            <button onClick={() => setShowModal(false)} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Wholesale Product Modal */}
      {showCatalogModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#FFFFFF', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 20px 0' }}>Publish Wholesale Product</h2>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Carton (100 packets)" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Price (₹)</label>
                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="850" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Bulk Stock Qty</label>
                <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="50" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Category</label>
              <select value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
                <option value="biscuits">Biscuits & Snacks</option>
                <option value="flour">Atta & Flours</option>
                <option value="soaps">Soaps & Shampoos</option>
                <option value="oil">Cooking Oils</option>
                <option value="general">General Items</option>
              </select>
            </div>

            <button onClick={handleAddWholesaleProduct} style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Publish Product</button>
            <button onClick={() => setShowCatalogModal(false)} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '10px', borderRadius: '10px', fontSize: '14px', marginTop: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-around', padding: '12px 0', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ textAlign: 'center', color: activeTab === 'dashboard' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{ fontSize: '20px' }}>📊</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Dashboard</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'shops' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('shops')}>
          <div style={{ fontSize: '20px' }}>🏪</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Shops</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'orders' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
          <div style={{ fontSize: '20px' }}>📥</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Orders</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'catalog' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>
          <div style={{ fontSize: '20px' }}>📦</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Catalog</span>
        </div>
        <div style={{ textAlign: 'center', color: activeTab === 'history' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('history')}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>History</span>
        </div>
      </div>

    </div>
  );
};

export default DistributorDashboard;
