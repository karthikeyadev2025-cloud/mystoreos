import { Home, Package, Receipt, Wallet, Truck, Book, LogOut, Users, IndianRupee } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const DesktopSidebar = ({ activeTab, setActiveTab, isOwner, pendingOrders, handleLogout, userName, syncStatus }) => {
  const { t, locale, setLocale, loadingLang } = useI18n();

  return (
    <div className="desktop-glass-sidebar">
      <div style={{ marginBottom: '24px', padding: '0 8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #fbbf24, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
          MyStore Pro
        </h2>
        <p style={{ margin: '4px 0 12px 0', fontSize: '11px', color: '#94a3b8' }}>{userName}</p>
        
        {/* Sleek premium language selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '12px' }}>🌐</span>
          <select 
            value={locale} 
            onChange={(e) => setLocale(e.target.value)} 
            disabled={loadingLang}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#f8fafc', 
              fontSize: '12px', 
              fontWeight: '500', 
              outline: 'none', 
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'inherit'
            }}
          >
            <option value="en" style={{ background: '#1e293b', color: '#f8fafc' }}>English (EN)</option>
            <option value="hi" style={{ background: '#1e293b', color: '#f8fafc' }}>हिन्दी (HI)</option>
            <option value="te" style={{ background: '#1e293b', color: '#f8fafc' }}>తెలుగు (TE)</option>
          </select>
          {loadingLang && <span style={{ fontSize: '10px', color: '#94a3b8' }}>⏳</span>}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <button className={`sidebar-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <Home size={18} /> {t('nav.home')}
        </button>
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <Package size={18} /> {t('nav.products')}
          </button>
        )}
        <button className={`sidebar-nav-item ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => setActiveTab('bills')} style={{ position: 'relative' }}>
          <Receipt size={18} /> {t('nav.bills')}
          {pendingOrders > 0 && <span style={{ position: 'absolute', top: 12, right: 16, background: '#ef4444', width: 8, height: 8, borderRadius: '50%' }}></span>}
        </button>
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            <Users size={18} /> {t('nav.customers')}
          </button>
        )}
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
            <IndianRupee size={18} /> {t('nav.expenses')}
          </button>
        )}
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'credit' ? 'active' : ''}`} onClick={() => setActiveTab('credit')}>
            <Wallet size={18} /> {t('nav.creditBook')}
          </button>
        )}
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'restock' ? 'active' : ''}`} onClick={() => setActiveTab('restock')}>
            <Truck size={18} /> {t('nav.restock')}
          </button>
        )}
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <Book size={18} /> {t('nav.dayBook')}
          </button>
        )}
        {isOwner && (
          <button className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <span style={{ fontSize: '18px' }}>⚙️</span> {t('nav.settings')}
          </button>
        )}
      </div>

      {syncStatus && (syncStatus.pendingCount > 0 || !syncStatus.isOnline) && (
        <div style={{ marginBottom: '8px' }}>
          {!syncStatus.isOnline && (
            <div style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', marginBottom: '4px', border: '1px solid rgba(245,158,11,0.15)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }}></span>
              {t('common.offline')}
            </div>
          )}
          {syncStatus.pendingCount > 0 && (
            <div style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }}></span>
              {syncStatus.pendingCount} pending sync
            </div>
          )}
        </div>
      )}

      <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', background: 'rgba(239,68,68,0.05)', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', outline: 'none', width: '100%' }}>
        <LogOut size={16} /> {t('nav.logout')}
      </button>
    </div>
  );
};

export default DesktopSidebar;
