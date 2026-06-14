import { Home, Package, Receipt, Users, Wallet, Book, Truck, BarChart2, Settings, Plus, LogOut } from 'lucide-react';

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// Real tabs (ids match ShopDashboard's activeTab exactly)
const TABS = [
  { id: 'home',      Icon: Home,      label: 'POS / Home' },
  { id: 'products',  Icon: Package,   label: 'Products',    ownerOnly: true },
  { id: 'bills',     Icon: Receipt,   label: 'All Bills',   badge: true },
  { id: 'customers', Icon: Users,     label: 'Customers' },
  { id: 'expenses',  Icon: Wallet,    label: 'Expenses',    ownerOnly: true },
  { id: 'credit',    Icon: Book,      label: 'Credit Book', ownerOnly: true },
  { id: 'restock',   Icon: Truck,     label: 'Restock',     ownerOnly: true },
  { id: 'reports',   Icon: BarChart2, label: 'Day Book',    ownerOnly: true },
  { id: 'profile',   Icon: Settings,  label: 'Settings',    ownerOnly: true },
];

export default function DesktopSidebar({ activeTab, setActiveTab, isOwner, pendingOrders = 0, handleLogout, userName = 'Shop', publicCode = '', syncStatus = {} }) {
  const visible = TABS.filter(t => !t.ownerOnly || isOwner);
  return (
    <aside style={{ width: 240, background: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', fontFamily: FONT }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>M</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>MyStore OS</div>
            <div style={{ color: '#94A3B8', fontSize: 11 }}>Enterprise</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 14px 6px' }}>
        <button onClick={() => setActiveTab('home')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, padding: '10px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> New Bill
        </button>
      </div>
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {visible.map(item => {
          const on = activeTab === item.id;
          const Icon = item.Icon;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 2, border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', fontFamily: FONT, fontSize: 13.5, fontWeight: on ? 700 : 500, background: on ? '#4F46E5' : 'transparent', color: on ? '#fff' : '#94A3B8', transition: 'background 0.15s, color 0.15s' }}
              onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E2E8F0'; } }}
              onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; } }}>
              <Icon size={17} strokeWidth={2} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && pendingOrders > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{pendingOrders}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {(userName || 'S').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
            <div style={{ color: '#94A3B8', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace" }}>{publicCode}</div>
          </div>
          <span title={syncStatus.isOnline === false ? 'Offline' : 'Synced'} style={{ width: 8, height: 8, borderRadius: '50%', background: syncStatus.isOnline === false ? '#F59E0B' : '#10B981', flexShrink: 0 }} />
        </div>
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px', fontFamily: FONT, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
