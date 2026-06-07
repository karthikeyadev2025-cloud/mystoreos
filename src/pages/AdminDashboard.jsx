import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  LayoutDashboard, Store, Truck, Users, CreditCard, Globe, Palette,
  MessageSquare, BarChart2, Download, Settings, LifeBuoy, LogOut, ChevronRight, Menu, X,
  CheckCircle, XCircle, Clock, Link
} from 'lucide-react';

const TabOverview     = lazy(() => import('./admin/TabOverview'));
const TabShops        = lazy(() => import('./admin/TabShops'));
const TabDistributors = lazy(() => import('./admin/TabDistributors'));
const TabUsers        = lazy(() => import('./admin/TabUsers'));
const TabRevenue      = lazy(() => import('./admin/TabRevenue'));
const TabCMS          = lazy(() => import('./admin/TabCMS'));
const TabDesign       = lazy(() => import('./admin/TabDesign'));
const TabComms        = lazy(() => import('./admin/TabComms'));
const TabAnalytics    = lazy(() => import('./admin/TabAnalytics'));
const TabExports      = lazy(() => import('./admin/TabExports'));
const TabSettings     = lazy(() => import('./admin/TabSettings'));
const TabSupport      = lazy(() => import('./admin/TabSupport'));
const TabAffiliate    = lazy(() => import('./admin/TabAffiliate'));

const TABS = [
  { id: 'overview',      label: 'Command Center',     Icon: LayoutDashboard, Component: TabOverview },
  { id: 'shops',         label: 'Shop Management',    Icon: Store,           Component: TabShops },
  { id: 'distributors',  label: 'Distributor Network',Icon: Truck,           Component: TabDistributors },
  { id: 'users',         label: 'User Directory',     Icon: Users,           Component: TabUsers },
  { id: 'revenue',       label: 'Revenue & Billing',  Icon: CreditCard,      Component: TabRevenue },
  { id: 'cms',           label: 'Website & CMS',      Icon: Globe,           Component: TabCMS },
  { id: 'design',        label: 'Design & CSS',       Icon: Palette,         Component: TabDesign },
  { id: 'comms',         label: 'Communications',     Icon: MessageSquare,   Component: TabComms },
  { id: 'analytics',     label: 'Analytics',          Icon: BarChart2,       Component: TabAnalytics },
  { id: 'exports',       label: 'Data Exports',       Icon: Download,        Component: TabExports },
  { id: 'settings',      label: 'System Settings',    Icon: Settings,        Component: TabSettings },
  { id: 'support',       label: 'Support & Audit',    Icon: LifeBuoy,        Component: TabSupport },
  { id: 'affiliate',     label: 'Affiliate & Referrals', Icon: Link,         Component: TabAffiliate },
];

const isMobile = () => window.innerWidth < 1024;

const TabFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#94a3b8', fontSize: '14px' }}>
    Loading tab...
  </div>
);

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    api.getPendingApprovals().then(arr => setPendingApprovals(arr || [])).catch(() => {});
  }, []);

  const approvePending = async (u) => {
    await api.approveUser(u.id);
    setPendingApprovals(prev => prev.filter(p => p.id !== u.id));
  };

  const approveAll = async () => {
    for (const u of pendingApprovals) {
      await api.approveUser(u.id);
    }
    setPendingApprovals([]);
  };

  const rejectPending = async (u) => {
    if (!window.confirm(`Reject and delete application from ${u.name}?`)) return;
    await api.deleteUser(u.id);
    setPendingApprovals(prev => prev.filter(p => p.id !== u.id));
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const activeTabDef = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = activeTabDef.Component;

  const sidebar = (
    <div style={{
      width: '260px', minWidth: '260px', background: '#0A0F1E', borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#E8A020', fontWeight: 800, fontSize: '16px' }}>MyStore OS</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>Admin Panel</div>
          </div>
          {isMobile() && (
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#2F7FFF,#E8A020)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#0F172A', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</div>
            <div style={{ color: '#64748b', fontSize: '10px' }}>Super Admin</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = id === activeTab;
          return (
            <button key={id} onClick={() => { setActiveTab(id); if (isMobile()) setSidebarOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                borderRadius: '8px', border: 'none', borderLeft: active ? '3px solid #2F7FFF' : '3px solid transparent',
                cursor: 'pointer', marginBottom: '2px', textAlign: 'left',
                background: active ? 'rgba(79,70,229,0.1)' : 'transparent',
                color: active ? '#2563EB' : '#94a3b8',
                fontWeight: active ? 600 : 400, fontSize: '13px', transition: 'all 0.15s',
                fontFamily: "'Sora', system-ui, sans-serif"
              }}>
              <Icon size={15} />
              <span style={{ flex: 1 }}>{label}</span>
              {id === 'shops' && pendingApprovals.length > 0 && (
                <span style={{ background: '#2563EB', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '999px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {pendingApprovals.length}
                </span>
              )}
              {active && <ChevronRight size={13} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: '13px', fontFamily: "'Sora', system-ui, sans-serif" }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080D1A', fontFamily: "'Sora', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @media(max-width:1023px){
          .admin-sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000}
          .admin-sidebar-wrap{position:fixed;bottom:0;left:0;right:0;height:auto;max-height:85vh;border-radius:20px 20px 0 0;overflow:hidden;z-index:1001}
          .admin-sidebar-wrap > div{height:auto!important;max-height:85vh;position:relative!important;width:100%!important;min-width:100%!important}
        }
      `}</style>
      {sidebarOpen && isMobile() && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      {sidebarOpen && (
        <div className={isMobile() ? 'admin-sidebar-wrap' : ''}>
          {sidebar}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(s => !s)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', width: 'auto', padding: '4px' }}>
            <Menu size={20} />
          </button>
          <div>
            <div style={{ color: '#0F172A', fontSize: '15px', fontWeight: 600 }}>{activeTabDef.label}</div>
          </div>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: '1400px', width: '100%', margin: '0 auto', background: '#0D1525' }}>
          {pendingApprovals.length > 0 && (
            <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563EB', boxShadow: '0 0 0 4px rgba(244,63,94,0.2)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                <div style={{ color: '#2563EB', fontWeight: 800, fontSize: '15px', flex: 1 }}>
                  ⚠️ {pendingApprovals.length} shop/distributor{pendingApprovals.length > 1 ? 's' : ''} waiting for approval
                </div>
                <button onClick={approveAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: '#10b981', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', flexShrink: 0 }}>
                  <CheckCircle size={13} /> Approve All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingApprovals.map(u => (
                  <div key={u.id} style={{ background: 'rgba(15,23,42,0.6)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#2F7FFF,#E8A020)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {(u.name || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={11} /> {u.role} · {u.phone}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => approvePending(u)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button onClick={() => rejectPending(u)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Suspense fallback={<TabFallback />}>
            <ActiveComponent />
          </Suspense>
        </main>
      </div>

      <ToastContainer position="bottom-right" theme="dark" toastStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }} />
    </div>
  );
}
