import { Home, Package, Receipt, Wallet, Truck, Book, BarChart2, Settings, Users, LogOut, Bell, TrendingUp, Coins, IndianRupee } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const INK  = '#0F172A'; // obsidian — exact demo token
const GOLD = '#4F46E5'; // indigo — exact demo token (was gold)
const BRD  = 'rgba(255,255,255,0.08)';
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const NAV_ITEMS = [
  { id:'home',      Icon:Home,      label:'POS / Home',   badge:false },
  { id:'products',  Icon:Package,   label:'Products',     badge:false, ownerOnly:true },
  { id:'bills',     Icon:Receipt,   label:'All Bills',    badge:true  },
  { id:'customers', Icon:Users,     label:'Customers',    badge:false },
  { id:'expenses',  Icon:Wallet,    label:'Expenses',     badge:false },
  { id:'credit',    Icon:Book,      label:'Credit Book',  badge:false },
  { id:'restock',   Icon:Truck,     label:'Restock',      badge:false },
  { id:'reports',   Icon:BarChart2, label:'Day Book',     badge:false },
  { id:'profile',   Icon:Settings,  label:'Settings',     badge:false },
];

const DesktopTopBar = ({
  activeTab, setActiveTab, isOwner,
  pendingOrders, handleLogout,
  userName, syncStatus,
}) => {
  return (
    <div style={{ position:'sticky', top:0, zIndex:999, fontFamily:FONT }}>
      {/* ── Brand bar ── */}
      <div style={{ background:INK, height:52, display:'flex', alignItems:'center', padding:'0 20px', gap:14, borderBottom:'1px solid '+BRD }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, background:GOLD, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:INK, letterSpacing:-1 }}>M</div>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:14, lineHeight:1 }}>MyStore OS</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:700, letterSpacing:'0.1em' }}>ENTERPRISE</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex:1, maxWidth:380, position:'relative' }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', fontSize:14, pointerEvents:'none' }}>🔍</span>
          <input
            placeholder="Search products, customers, bills…"
            style={{ width:'100%', padding:'7px 10px 7px 32px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'#fff', fontSize:12, fontFamily:FONT, outline:'none', boxSizing:'border-box' }}
          />
        </div>

        {/* Right side */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {/* Sync indicator */}
          {syncStatus && (
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'rgba(255,255,255,0.38)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:syncStatus.isOnline?'#059669':'#F59E0B', flexShrink:0 }} />
              {syncStatus.isOnline ? (syncStatus.pendingCount>0?'Syncing…':'Synced') : 'Offline'}
            </div>
          )}
          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.12)' }} />
          {/* Notification */}
          <div style={{ width:32, height:32, borderRadius:7, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Bell size={15} color="rgba(255,255,255,0.55)" />
          </div>
          {/* User */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px 5px 5px', borderRadius:8, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>
            <div style={{ width:26, height:26, background:GOLD, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:INK }}>{(userName||'S').slice(0,2).toUpperCase()}</div>
            <div>
              <div style={{ color:'#fff', fontSize:11, fontWeight:700, lineHeight:1 }}>{userName||'Shop'}</div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:9 }}>Owner</div>
            </div>
          </div>
          {/* Logout */}
          <button onClick={handleLogout} style={{ width:32, height:32, borderRadius:7, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <LogOut size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
      </div>

      {/* ── Module tabs ── */}
      <div style={{ background:'#fff', borderBottom:'1.5px solid #D8E0EE', display:'flex', alignItems:'stretch', padding:'0 16px', gap:2, height:46, boxShadow:'0 2px 8px rgba(14,27,51,0.05)' }}>
        {NAV_ITEMS.map(({ id, Icon, label, badge, ownerOnly }) => {
          if (ownerOnly && !isOwner) return null;
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'0 14px', border:'none', background:'transparent', color:active?'#0F172A':' #6473A0', fontSize:12, fontWeight:active?700:500, fontFamily:FONT, cursor:'pointer', position:'relative', transition:'color 0.15s', whiteSpace:'nowrap' }}
              onMouseEnter={e => { if(!active) e.currentTarget.style.color='#4F46E5'; }}
              onMouseLeave={e => { if(!active) e.currentTarget.style.color='#64748B'; }}
            >
              <Icon size={14} color={active?GOLD:'currentColor'} style={{ flexShrink:0 }} />
              {label}
              {badge && pendingOrders > 0 && (
                <span style={{ background:'#E53E3E', color:'#fff', borderRadius:10, padding:'1px 5px', fontSize:9, fontWeight:800, marginLeft:2 }}>{pendingOrders}</span>
              )}
              {active && <div style={{ position:'absolute', bottom:0, left:8, right:8, height:2.5, borderRadius:'2px 2px 0 0', background:'#0F172A' }} />}
            </button>
          );
        })}
        {/* New Bill CTA */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, paddingRight:4 }}>
          <button onClick={() => setActiveTab('home')} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:7, border:'none', background:'#4F46E5', color:'#fff', fontSize:11, fontWeight:700, fontFamily:FONT, cursor:'pointer', transition:'all 0.15s' }}>
            + New Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopTopBar;