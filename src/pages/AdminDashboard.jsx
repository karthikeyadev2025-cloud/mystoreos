import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ToastContainer, toast } from 'react-toastify';
import { ADMIN_GLOBAL_CSS } from './admin/_ui';
import NotificationCenter from '../components/NotificationCenter';
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

const TabFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: 'var(--c-muted)', fontSize: '14px' }}>
    Loading tab...
  </div>
);

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    api.getPendingApprovals().then(arr => setPendingApprovals(arr || [])).catch(() => {});
  }, []);

  const approvePending = async (u) => {
    try {
      await api.approveUser(u.id);
      setPendingApprovals(prev => prev.filter(p => p.id !== u.id));
      toast.success(`${u.name || 'User'} approved`);
    } catch (e) {
      toast.error(e.message || 'Failed to approve — please try again');
    }
  };

  const approveAll = async () => {
    let failed = 0;
    // Was removing everyone from the list unconditionally after the loop,
    // regardless of whether any individual approveUser call actually
    // succeeded — a silent failure partway through would still show an
    // empty Pending Approvals list while some accounts stayed unapproved.
    for (const u of pendingApprovals) {
      try {
        await api.approveUser(u.id);
        setPendingApprovals(prev => prev.filter(p => p.id !== u.id));
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      toast.error(`${failed} approval${failed === 1 ? '' : 's'} failed — they remain in the list, please retry`);
    } else {
      toast.success('All pending accounts approved');
    }
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
      width: '260px', minWidth: '260px', background: 'var(--c-surface)', borderRight: '1px solid var(--c-line)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--c-line)', background: 'linear-gradient(135deg, var(--c-primary) 0%, var(--c-violet) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--c-surface)', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em' }}>MyStore OS</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>Enterprise · Admin</div>
          </div>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'var(--c-surface)', cursor: 'pointer', borderRadius: 6, padding: 4, width: 'auto' }}>
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--c-warning),var(--c-warning))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--c-surface)', flexShrink: 0, boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'var(--c-surface)', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px' }}>Super Admin · Full Access</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = id === activeTab;
          return (
            <button key={id} onClick={() => { setActiveTab(id); if (isMobile) setSidebarOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                borderRadius: '8px', border: 'none', borderLeft: active ? '3px solid var(--c-primary)' : '3px solid transparent',
                cursor: 'pointer', marginBottom: '2px', textAlign: 'left',
                background: active ? 'rgba(79,70,229,0.08)' : 'transparent',
                color: active ? 'var(--c-primary)' : 'var(--c-ink-2)',
                fontWeight: active ? 600 : 400, fontSize: '13px', transition: 'all 0.15s',
                fontFamily: "'Sora', system-ui, sans-serif"
              }}>
              <Icon size={15} />
              <span style={{ flex: 1 }}>{label}</span>
              {id === 'shops' && pendingApprovals.length > 0 && (
                <span style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', fontSize: '10px', fontWeight: 800, borderRadius: '999px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {pendingApprovals.length}
                </span>
              )}
              {active && <ChevronRight size={13} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid var(--c-line)' }}>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--c-danger)', fontSize: '13px', fontFamily: "'Sora', system-ui, sans-serif" }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--c-line-soft)', fontFamily: "'Sora', system-ui, sans-serif" }}>
      <style>{`
        ${ADMIN_GLOBAL_CSS}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @media(max-width:1023px){
          .admin-sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000}
          .admin-sidebar-wrap{position:fixed;bottom:0;left:0;right:0;height:auto;max-height:85vh;border-radius:20px 20px 0 0;overflow:hidden;z-index:1001;box-shadow:0 -4px 20px rgba(0,0,0,0.08)}
          .admin-sidebar-wrap > div{height:auto!important;max-height:85vh;position:relative!important;width:100%!important;min-width:100%!important}
        }
      `}</style>
      {sidebarOpen && isMobile && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      {sidebarOpen && (
        <div className={isMobile ? 'admin-sidebar-wrap' : ''}>
          {sidebar}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-line)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '14px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 0 rgba(15,23,42,0.03)' }}>
          <button onClick={() => setSidebarOpen(s => !s)} style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', color: 'var(--c-ink-2)', cursor: 'pointer', display: 'flex', width: 'auto', padding: '6px', borderRadius: 6 }}>
            <Menu size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--c-faint)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Admin · {activeTabDef.id === 'overview' ? 'Home' : 'Section'}</div>
            <div style={{ color: 'var(--c-ink)', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>{activeTabDef.label}</div>
          </div>
          <NotificationCenter
            userId={user?.id}
            onToast={(row) => toast.info(row.title, { autoClose: 5000, position: 'top-right' })}
          />
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 12px' : '28px 32px', maxWidth: '1400px', width: '100%', margin: '0 auto', background: 'var(--c-line-soft)' }}>
          {pendingApprovals.length > 0 && (
            <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--c-primary)', boxShadow: '0 0 0 4px rgba(244,63,94,0.2)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                <div style={{ color: 'var(--c-danger)', fontWeight: 800, fontSize: '15px', flex: 1 }}>
                  ⚠️ {pendingApprovals.length} shop/distributor{pendingApprovals.length > 1 ? 's' : ''} waiting for approval
                </div>
                <button onClick={approveAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: 'var(--c-success)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans), sans-serif', flexShrink: 0 }}>
                  <CheckCircle size={13} /> Approve All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingApprovals.map(u => (
                  <div key={u.id} className='premium-glass-card premium-glass-card-hover' style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--c-primary),var(--c-accent-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: 'var(--c-surface)', flexShrink: 0 }}>
                      {(u.name || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--c-ink)', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <div style={{ color: 'var(--c-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={11} /> {u.role} · {u.phone}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => approvePending(u)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: 'var(--c-success)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans), sans-serif' }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button onClick={() => rejectPending(u)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--c-danger)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans), sans-serif' }}>
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

      <ToastContainer position="bottom-right" theme="light" toastStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '10px' }} />
    </div>
  );
}
