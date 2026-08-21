import { Home, Package, Receipt, Users, Wallet, Book, Truck, BarChart2, Settings, Plus, LogOut, Building2, Scissors, CreditCard, Star, Sparkles } from 'lucide-react';
import { isServiceBusinessKind } from '../lib/businessKind';

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// Real tabs (ids match ShopDashboard's activeTab exactly)
// retailOnly = irrelevant for pure service shops (spas, salons, clinics,
// gyms — no physical stock to manage). Kept visible on retail and mixed
// shops. Owner can still bill add-on retail products from Sales/POS
// even on a service shop; the retail-only tabs just remove the cognitive
// noise from the sidebar when they'd never be used.
const TABS = [
  { id: 'dashboard',  Icon: BarChart2,  label: 'Dashboard',   serviceOnly: true },
  { id: 'home',       Icon: Home,       label: 'POS / Home' },
  { id: 'branches',   Icon: Building2,  label: 'Branches',    ownerOnly: true, multiBranchOnly: true },
  { id: 'products',   Icon: Package,    label: 'Products',    ownerOnly: true, retailOnly: true },
  { id: 'bills',      Icon: Receipt,    label: 'All Bills',   badge: true },
  { id: 'customers',  Icon: Users,      label: 'Customers' },
  { id: 'expenses',   Icon: Wallet,     label: 'Expenses',    ownerOnly: true },
  { id: 'credit',     Icon: Book,       label: 'Credit Book', ownerOnly: true, retailOnly: true },
  { id: 'bookings',   Icon: Scissors,   label: 'Bookings',    ownerOnly: false, serviceOnly: true },
  // For service businesses, the Services catalogue and Staff manager
  // are important enough workflows to warrant dedicated sidebar entries
  // rather than being buried as sub-tabs behind Bookings. They still
  // route through DesktopBookings under the hood (same component, just
  // opened on a different sub-tab via the initialTab prop).
  { id: 'services',   Icon: Sparkles,   label: 'Services',    ownerOnly: true, serviceOnly: true },
  { id: 'staff',      Icon: Users,      label: 'Staff',       ownerOnly: true, serviceOnly: true },
  { id: 'membership', Icon: CreditCard, label: 'Membership',  ownerOnly: true },
  { id: 'feedback',   Icon: Star,       label: 'Feedback',    ownerOnly: true },
  { id: 'restock',    Icon: Truck,      label: 'Restock',     ownerOnly: true, retailOnly: true },
  { id: 'reports',    Icon: BarChart2,  label: 'Day Book',    ownerOnly: true },
  { id: 'profile',    Icon: Settings,   label: 'Settings',    ownerOnly: true },
];

export default function DesktopSidebar({ activeTab, setActiveTab, isOwner, pendingOrders = 0, handleLogout, userName = 'Shop', publicCode = '', syncStatus = {}, hasMultipleBranches = false, shopCategory = 'retail', businessKind = null, canBookings = true }) {
  // Prefer the explicit business_kind field (set at signup, LOCKED). Fall
  // back to category-name matching (isServiceCategory, shared with
  // ShopDashboard.jsx) for legacy accounts that predate the business_kind
  // column.
  const isServiceBiz = isServiceBusinessKind(businessKind, shopCategory);

  // For service businesses: a dedicated Dashboard (appointments/revenue
  // summary) leads, then Sales/POS (still needed for billing retail
  // add-ons like shampoo, retail products alongside services), then
  // Bookings for managing the appointment calendar and service catalogue.
  // For product businesses: keep original order, no Dashboard tab at all
  // (their 'home'/POS screen already serves that purpose).
  const tabs = isServiceBiz
    ? TABS.map(t => t.id === 'home' ? { ...t, label: 'Sales / POS' } : t)
        .sort((a, b) => {
          const orderService = ['dashboard','home','bookings','services','staff','customers','membership','feedback','bills','products','branches','expenses','credit','restock','reports','profile'];
          return orderService.indexOf(a.id) - orderService.indexOf(b.id);
        })
    : TABS;

  const visible = tabs.filter(t => {
    if (t.serviceOnly && !isServiceBiz) return false;
    if (t.retailOnly && isServiceBiz) return false;
    if (t.ownerOnly && !isOwner) return false;
    if (t.multiBranchOnly && !hasMultipleBranches) return false;
    // Was missing entirely — serviceOnly alone only checked whether
    // this IS a service business, never whether their actual plan
    // tier grants bookings access at all. A Starter-tier service
    // account (bookings: false in PLAN_CAPS.starter) could see and
    // open the full Bookings/Services/Staff surface regardless —
    // exactly the "a spec change silently opens a Pro feature to
    // Starter tier" revenue leak the test suite (tests/plan-gates.spec.js)
    // was specifically written to catch.
    if (['bookings', 'services', 'staff'].includes(t.id) && !canBookings) return false;
    return true;
  });
  return (
    <aside style={{ width: 240, background: 'var(--c-ink)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', left: 0, top: 0, height: '100vh', overflowY: 'auto', zIndex: 50, fontFamily: FONT }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--c-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-surface)', fontWeight: 800, fontSize: 16 }}>M</div>
          <div>
            <div style={{ color: 'var(--c-surface)', fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>MyStore OS</div>
            <div style={{ color: 'var(--c-faint)', fontSize: 11 }}>Enterprise</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 14px 6px' }}>
        <button onClick={() => setActiveTab('home')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', borderRadius: 9, padding: '10px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> New Bill
        </button>
      </div>
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {visible.map(item => {
          const on = activeTab === item.id;
          const Icon = item.Icon;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 2, border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', fontFamily: FONT, fontSize: 13.5, fontWeight: on ? 700 : 500, background: on ? 'var(--c-primary)' : 'transparent', color: on ? 'var(--c-surface)' : 'var(--c-faint)', transition: 'background 0.15s, color 0.15s' }}
              onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--c-line)'; } }}
              onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-faint)'; } }}>
              <Icon size={17} strokeWidth={2} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && pendingOrders > 0 && (
                <span style={{ background: 'var(--c-danger)', color: 'var(--c-surface)', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{pendingOrders}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Identity row only — no switcher dropdown. Branches tab handles
            switching via clickable branch cards. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--c-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-surface)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {(userName || 'S').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: 'var(--c-surface)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
            <div style={{ color: 'var(--c-faint)', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace" }}>{publicCode}</div>
          </div>
          <span title={syncStatus.isOnline === false ? 'Offline' : 'Synced'} style={{ width: 8, height: 8, borderRadius: '50%', background: syncStatus.isOnline === false ? 'var(--c-warning)' : 'var(--c-success)', flexShrink: 0 }} />
        </div>
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'transparent', color: 'var(--c-faint)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px', fontFamily: FONT, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--c-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-faint)'; }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
