import { Home, Package, Receipt, Wallet, Truck, Book, LogOut, Users, BarChart2, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const INK  = '#0A0F1E';
const GOLD = '#E8A020';
const ACT  = 'rgba(255,255,255,0.13)';
const HOV  = 'rgba(255,255,255,0.07)';
const BRD  = 'rgba(255,255,255,0.07)';
const FONT = "'Sora', system-ui, sans-serif";

const NAV = [
  { id:'home',      Icon:Home,      key:'nav.home',      fb:'POS / Home',   badge:false },
  { id:'products',  Icon:Package,   key:'nav.products',  fb:'Products',     badge:false, ownerOnly:true },
  { id:'bills',     Icon:Receipt,   key:'nav.bills',     fb:'All Bills',    badge:true  },
  { id:'customers', Icon:Users,     key:'nav.customers', fb:'Customers',    badge:false },
  { id:'expenses',  Icon:Wallet,    key:'nav.expenses',  fb:'Expenses',     badge:false },
  { id:'credit',    Icon:Book,      key:'nav.credit',    fb:'Credit Book',  badge:false },
  { id:'restock',   Icon:Truck,     key:'nav.restock',   fb:'Bulk Restock', badge:false },
  { id:'reports',   Icon:BarChart2, key:'nav.reports',   fb:'Day Book',     badge:false },
  { id:'settings',  Icon:Settings,  key:'nav.settings',  fb:'Settings',     badge:false },
];

const DesktopSidebar = ({ activeTab, setActiveTab, isOwner, pendingOrders, handleLogout, userName, syncStatus }) => {
  const { t } = useI18n();
  return (
    <div style={{ width:224, minWidth:224, background:INK, display:'flex', flexDirection:'column', height:'100%', flexShrink:0, fontFamily:FONT }}>
      <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid '+BRD, display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:34, height:34, background:GOLD, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:INK, letterSpacing:-1, flexShrink:0 }}>M</div>
        <div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:14, lineHeight:1 }}>MyStore OS</div>
          <div style={{ marginTop:4, background:'rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 7px', display:'inline-block' }}>
            <span style={{ color:'rgba(255,255,255,0.45)', fontSize:8, fontWeight:700, letterSpacing:'0.1em' }}>ENTERPRISE</span>
          </div>
        </div>
      </div>
      <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid '+BRD }}>
        <div style={{ color:'#CBD5F0', fontSize:12, fontWeight:700 }}>{userName}</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#4ADE80', animation:'enterprise-pulse 2s infinite', flexShrink:0 }} />
          <span style={{ color:'rgba(255,255,255,0.38)', fontSize:10 }}>Open now</span>
        </div>
      </div>
      <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
        {NAV.map(({ id, Icon, key, fb, badge, ownerOnly }) => {
          if (ownerOnly && !isOwner) return null;
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, border:'none', cursor:'pointer', textAlign:'left', width:'100%', background:active?ACT:'transparent', color:active?'#fff':'rgba(255,255,255,0.48)', fontSize:12, fontWeight:active?700:400, fontFamily:FONT, position:'relative', transition:'all 0.15s' }}
              onMouseEnter={e => { if(!active){ e.currentTarget.style.background=HOV; e.currentTarget.style.color='rgba(255,255,255,0.8)'; }}}
              onMouseLeave={e => { if(!active){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.48)'; }}}
            >
              {active && <div style={{ position:'absolute', left:0, top:'18%', bottom:'18%', width:3, borderRadius:'0 3px 3px 0', background:GOLD }} />}
              <Icon size={15} color={active?GOLD:'rgba(255,255,255,0.32)'} style={{ flexShrink:0, marginLeft:active?3:0 }} />
              <span style={{ flex:1 }}>{t(key)||fb}</span>
              {badge && pendingOrders > 0 && <span style={{ background:'#E53E3E', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:9, fontWeight:800 }}>{pendingOrders}</span>}
            </button>
          );
        })}
      </nav>
      {syncStatus && (
        <div style={{ padding:'7px 14px', borderTop:'1px solid '+BRD, display:'flex', alignItems:'center', gap:6, fontSize:10, color:'rgba(255,255,255,0.3)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:syncStatus==='synced'?'#4ADE80':'#F59E0B', flexShrink:0 }} />
          {syncStatus==='synced' ? 'All synced' : 'Syncing…'}
        </div>
      )}
      <div style={{ padding:'10px', borderTop:'1px solid '+BRD }}>
        <button onClick={handleLogout}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, border:'none', background:'transparent', color:'rgba(255,255,255,0.32)', fontSize:11, fontFamily:FONT, width:'100%', cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,0.65)'; e.currentTarget.style.background=HOV; }}
          onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.32)'; e.currentTarget.style.background='transparent'; }}
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default DesktopSidebar;