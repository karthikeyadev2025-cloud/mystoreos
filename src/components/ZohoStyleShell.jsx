import { useState } from 'react';
import {
  LayoutDashboard, Receipt, Package, Users, BookOpen, RotateCcw,
  Wallet, BarChart3, Settings as SettingsIcon, Search, Bell, Plus,
  ChevronRight, TrendingUp, TrendingDown
} from 'lucide-react';

/*
  ZOHO-STYLE SHELL — structural redesign proof.
  Key ideas borrowed from Zoho Books:
   - Dark left sidebar app shell (module nav), NOT top tabs
   - Calm white content canvas, generous whitespace
   - Restrained color: white/grey + one accent; data uses muted tints
   - Clean data sections & tables, strong typographic hierarchy
   - No gradients, no emoji, no rainbow stat boxes
  This is a standalone preview — the working ShopDashboard is untouched.
*/

const NAV = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'billing', label: 'Billing / POS', icon: Receipt },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'credit', label: 'Credit Book', icon: BookOpen },
  { id: 'restock', label: 'Restock', icon: RotateCcw },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const C = {
  sidebar: '#0F172A',
  sidebarText: '#94A3B8',
  sidebarActive: '#4F46E5',
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  line: '#E2E8F0',
  ink: '#0F172A',
  ink2: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  primary: '#4F46E5',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
};

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function ZohoStyleShell({ shopName = 'My Shop', shopCode = '', onExit }) {
  const [active, setActive] = useState('home');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.canvas, fontFamily: font, color: C.ink }}>
      {/* ── Left sidebar ── */}
      <aside style={{ width: 240, background: C.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>M</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>MyStore OS</div>
              <div style={{ color: C.sidebarText, fontSize: 11 }}>Enterprise</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const on = active === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActive(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', marginBottom: 2, border: 'none', cursor: 'pointer',
                  borderRadius: 8, textAlign: 'left', fontFamily: font, fontSize: 13.5,
                  fontWeight: on ? 700 : 500,
                  background: on ? C.sidebarActive : 'transparent',
                  color: on ? '#fff' : C.sidebarText,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E2E8F0'; } }}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sidebarText; } }}
              >
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {shopName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shopName}</div>
              <div style={{ color: C.faint, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace" }}>{shopCode}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 60, background: C.surface, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', width: 360, maxWidth: '40vw' }}>
            <Search size={15} color={C.faint} />
            <input placeholder="Search customers, invoices, items…" style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13, color: C.ink, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontFamily: font, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={15} /> New Bill
            </button>
            <Bell size={18} color={C.muted} style={{ cursor: 'pointer' }} />
            {onExit && <button onClick={onExit} style={{ fontSize: 12, color: C.muted, background: 'none', border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: font }}>Exit preview</button>}
          </div>
        </header>

        {/* Content canvas */}
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1200 }}>
          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Overview of your store's performance today.</p>
          </div>

          {/* KPI row — restrained, Zoho-style: white cards, small grey labels, big numbers, one accent */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: "TODAY'S SALES", value: '₹12,480', delta: '+18%', up: true },
              { label: 'NEW ORDERS', value: '24', delta: '+6', up: true },
              { label: 'LOW STOCK ITEMS', value: '3', delta: 'Action needed', up: false, warn: true },
              { label: 'SUPPLIER CREDIT', value: '₹4,200', delta: 'Due in 5 days', up: false },
            ].map((k, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '18px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: '0.05em' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, margin: '8px 0 6px', letterSpacing: '-0.02em' }}>{k.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: k.warn ? C.warning : k.up ? C.success : C.muted }}>
                  {k.up === true && <TrendingUp size={13} />}
                  {k.up === false && !k.warn && <span />}
                  {k.delta}
                </div>
              </div>
            ))}
          </div>

          {/* Two-column data layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
            {/* Recent invoices — clean data TABLE, not cards */}
            <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Invoices</h2>
                <button style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: font }}>
                  View all <ChevronRight size={14} />
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.canvas }}>
                    {['Invoice', 'Customer', 'Amount', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: '#INV-1042', cust: 'Ramesh Kumar', amt: '₹1,250', st: 'Paid', c: C.success },
                    { id: '#INV-1041', cust: 'Walk-in Customer', amt: '₹480', st: 'Paid', c: C.success },
                    { id: '#INV-1040', cust: 'Sai Traders', amt: '₹3,600', st: 'Pending', c: C.warning },
                    { id: '#INV-1039', cust: 'Priya S', amt: '₹920', st: 'Paid', c: C.success },
                    { id: '#INV-1038', cust: 'Anand Stores', amt: '₹5,140', st: 'Overdue', c: C.danger },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink2 }}>{r.id}</td>
                      <td style={{ padding: '12px 20px', color: C.ink }}>{r.cust}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: C.ink }}>{r.amt}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.c, background: r.c + '18', padding: '3px 10px', borderRadius: 999 }}>{r.st}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Side column: top products list + low stock */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.line}` }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Top Selling</h2>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {[
                    { n: 'Sona Masoori Rice', q: '42 sold', amt: '₹52,500' },
                    { n: 'Fortune Oil 5L', q: '28 sold', amt: '₹18,200' },
                    { n: 'Amul Milk 1L', q: '90 sold', amt: '₹6,120' },
                  ].map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{p.n}</div>
                        <div style={{ fontSize: 11.5, color: C.faint }}>{p.q}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.amt}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <TrendingDown size={15} color={C.warning} />
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Low Stock Alert</h2>
                </div>
                <p style={{ fontSize: 12.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                  3 items are running low. Review and restock before the weekend rush.
                </p>
                <button style={{ marginTop: 12, width: '100%', background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px', fontSize: 12.5, fontWeight: 700, color: C.primary, cursor: 'pointer', fontFamily: font }}>
                  Review restock list
                </button>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
