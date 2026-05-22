import { useState, lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  LayoutDashboard, Store, Truck, Users, CreditCard, Globe, Palette,
  MessageSquare, BarChart2, Download, Settings, LifeBuoy, LogOut, ChevronRight, Menu, X
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

  const handleLogout = () => { logout(); navigate('/login'); };

  const activeTabDef = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = activeTabDef.Component;

  const sidebar = (
    <div style={{
      width: '240px', minWidth: '240px', background: 'rgba(15,23,42,0.95)', borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, backdropFilter: 'blur(12px)'
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#f43f5e', fontWeight: 800, fontSize: '16px' }}>MyStore OS</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>Admin Panel</div>
          </div>
          {isMobile() && (
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</div>
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
                borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', textAlign: 'left',
                background: active ? 'rgba(244,63,94,0.12)' : 'transparent',
                color: active ? '#f43f5e' : '#94a3b8',
                fontWeight: active ? 600 : 400, fontSize: '13px', transition: 'all 0.15s',
                fontFamily: 'Outfit, sans-serif'
              }}>
              <Icon size={15} />
              <span style={{ flex: 1 }}>{label}</span>
              {active && <ChevronRight size={13} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
      {sidebarOpen && sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(s => !s)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <Menu size={20} />
          </button>
          <div>
            <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600 }}>{activeTabDef.label}</div>
          </div>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Suspense fallback={<TabFallback />}>
            <ActiveComponent />
          </Suspense>
        </main>
      </div>

      <ToastContainer position="bottom-right" theme="dark" toastStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }} />
    </div>
  );
}
