import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { 
  Save, LayoutTemplate, CreditCard, Megaphone, AlertCircle, 
  Settings, CheckCircle, ArrowRight, Eye, Sparkles
} from 'lucide-react';

const AdminCMS = () => {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [heroConfig, setHeroConfig] = useState({
    headline: 'Your Phone is Your Billing Machine.',
    subtitle: 'Join 50,000+ Indian shopkeepers replacing ₹15,000 computers with a simple app.',
    buttonText: 'Start Free Trial'
  });
  
  const [announceConfig, setAnnounceConfig] = useState({
    active: false,
    text: '🚨 System Update: New features added!',
    type: 'info'
  });

  const [pricingConfig, setPricingConfig] = useState({
    proPrice: '999',
    proName: 'Pro Plan',
    freeFeatures: 'Basic billing, 50 products',
    proFeatures: 'Unlimited everything, WhatsApp orders, Custom Domain'
  });

  useEffect(() => {
    loadCMS();
  }, []);

  const loadCMS = async () => {
    try {
      const hero = await api.getSiteConfig('hero', heroConfig);
      const announce = await api.getSiteConfig('announcement', announceConfig);
      const pricing = await api.getSiteConfig('pricing', pricingConfig);
      
      setHeroConfig(hero);
      setAnnounceConfig(announce);
      setPricingConfig(pricing);
    } catch(err) {
      toast.error('Failed to sync content parameters');
    }
    setLoading(false);
  };

  const handleSave = async (key, value) => {
    setSaving(true);
    try {
      await api.saveSiteConfig(key, value);
      toast.success(`${key.toUpperCase()} configurations committed to production!`);
    } catch(err) {
      toast.error(`Failed to commit ${key} changes`);
    } finally {
      setSaving(false);
    }
  };

  const styles = {
    glassCard: {
      background: 'linear-gradient(135deg, rgba(20, 25, 46, 0.45) 0%, rgba(10, 13, 26, 0.6) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '20px',
      padding: '28px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(20px)'
    },
    tabBtn: (active, color) => ({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '12px 16px',
      background: active ? color : 'rgba(255,255,255,0.02)',
      border: '1px solid ' + (active ? 'transparent' : 'rgba(255,255,255,0.05)'),
      borderRadius: '12px',
      color: active ? '#000' : '#94a3b8',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: active ? '0 8px 16px ' + color + '40' : 'none',
      transition: 'all 0.2s ease'
    }),
    label: {
      display: 'block',
      fontSize: '12px',
      color: '#cbd5e1',
      marginBottom: '8px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      background: 'rgba(5, 7, 14, 0.6)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s'
    },
    saveBtn: (color) => ({
      width: '100%',
      background: color,
      color: '#000',
      border: 'none',
      padding: '16px',
      borderRadius: '12px',
      fontSize: '15px',
      fontWeight: 900,
      cursor: 'pointer',
      boxShadow: '0 8px 24px ' + color + '30',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '20px',
      transition: 'all 0.2s'
    })
  };

  if (loading) return <div style={{padding: '30px', color: '#fff', textAlign: 'center', fontSize: '15px'}}>Syncing content configurations...</div>;

  return (
    <div style={styles.glassCard}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Website CMS (Live Editor)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Update hero text, pricing parameters, and push live system banners globally.</p>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '30px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={12} /> Direct Database Safe
        </div>
      </div>
      
      {/* CMS Tab Switcher */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('hero')} style={styles.tabBtn(activeTab === 'hero', '#fbbf24')}>
          <LayoutTemplate size={16} /> Header & Hero
        </button>
        <button onClick={() => setActiveTab('pricing')} style={styles.tabBtn(activeTab === 'pricing', '#3b82f6')}>
          <CreditCard size={16} /> Pricing Plans
        </button>
        <button onClick={() => setActiveTab('announce')} style={styles.tabBtn(activeTab === 'announce', '#10b981')}>
          <Megaphone size={16} /> Announcement Board
        </button>
      </div>

      {/* HERO TAB CONTAINER */}
      {activeTab === 'hero' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#fbbf24', fontSize: '14px', fontWeight: 'bold' }}>Hero Layout Context</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                This section manages the very first screen users see when landing on your homepage. Modifying this changes the primary value proposition immediately.
              </p>
            </div>
          </div>

          <div>
            <label style={styles.label}>Primary Headline</label>
            <input 
              type="text" 
              value={heroConfig.headline} 
              onChange={e => setHeroConfig({...heroConfig, headline: e.target.value})} 
              style={styles.input} 
            />
          </div>
          
          <div>
            <label style={styles.label}>Core Subtitle / Paragraph</label>
            <textarea 
              value={heroConfig.subtitle} 
              onChange={e => setHeroConfig({...heroConfig, subtitle: e.target.value})} 
              style={{...styles.input, height: '100px', resize: 'vertical'}} 
            />
          </div>

          <div>
            <label style={styles.label}>Primary CTA Button Text</label>
            <input 
              type="text" 
              value={heroConfig.buttonText} 
              onChange={e => setHeroConfig({...heroConfig, buttonText: e.target.value})} 
              style={styles.input} 
            />
          </div>

          <button onClick={() => handleSave('hero', heroConfig)} disabled={saving} style={styles.saveBtn('#fbbf24')}>
            <Save size={16} /> {saving ? 'Committing...' : 'Commit Hero Updates'}
          </button>
        </div>
      )}

      {/* PRICING TAB CONTAINER */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '14px', fontWeight: 'bold' }}>SaaS Subscription Settings</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Manage pricing structures and list core features. These values are automatically rendered inside your dynamic landing page pricing grid.
              </p>
            </div>
          </div>

          <div>
            <label style={styles.label}>Pro Plan Price (Monthly INR ₹)</label>
            <input 
              type="number" 
              value={pricingConfig.proPrice} 
              onChange={e => setPricingConfig({...pricingConfig, proPrice: e.target.value})} 
              style={styles.input} 
            />
          </div>
          
          <div>
            <label style={styles.label}>Free Plan Features (Comma separated)</label>
            <textarea 
              value={pricingConfig.freeFeatures} 
              onChange={e => setPricingConfig({...pricingConfig, freeFeatures: e.target.value})} 
              style={{...styles.input, height: '70px', resize: 'vertical'}} 
            />
          </div>

          <div>
            <label style={styles.label}>Pro Plan Features (Comma separated)</label>
            <textarea 
              value={pricingConfig.proFeatures} 
              onChange={e => setPricingConfig({...pricingConfig, proFeatures: e.target.value})} 
              style={{...styles.input, height: '90px', resize: 'vertical'}} 
            />
          </div>

          <button onClick={() => handleSave('pricing', pricingConfig)} disabled={saving} style={styles.saveBtn('#60a5fa')}>
            <Save size={16} /> {saving ? 'Committing...' : 'Commit SaaS Pricing'}
          </button>
        </div>
      )}

      {/* ANNOUNCEMENT TAB CONTAINER */}
      {activeTab === 'announce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Megaphone size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>Global Broadcast System</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Activate a global warning or informational banner that will instantly appear at the top of every onboarded shopkeeper's active dashboard.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Announcement Banner Activation</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Turn banner ON/OFF instantly across all panels</div>
            </div>
            
            {/* Custom Modern Toggle Switch */}
            <label style={{ display: 'inline-flex', position: 'relative', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={announceConfig.active} 
                onChange={e => setAnnounceConfig({...announceConfig, active: e.target.checked})} 
                style={{ srOnly: true, width: 0, height: 0, opacity: 0 }} 
              />
              <div style={{
                width: '50px',
                height: '26px',
                backgroundColor: announceConfig.active ? '#10b981' : '#1e293b',
                borderRadius: '100px',
                position: 'relative',
                transition: 'background-color 0.2s',
                boxShadow: announceConfig.active ? '0 0 10px rgba(16,185,129,0.4)' : 'none'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '3px',
                  left: announceConfig.active ? '27px' : '3px',
                  transition: 'left 0.2s'
                }}></div>
              </div>
            </label>
          </div>
          
          <div>
            <label style={styles.label}>Broadcast Message Content</label>
            <textarea 
              value={announceConfig.text} 
              onChange={e => setAnnounceConfig({...announceConfig, text: e.target.value})} 
              style={{...styles.input, height: '80px', resize: 'vertical'}} 
            />
          </div>

          <div>
            <label style={styles.label}>Broadcast Notification Level</label>
            <select 
              value={announceConfig.type} 
              onChange={e => setAnnounceConfig({...announceConfig, type: e.target.value})} 
              style={{
                ...styles.input,
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cbd5e1\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option value="info">🔵 Information (Blue)</option>
              <option value="warning">🟡 Attention Alert (Yellow)</option>
              <option value="success">🟢 Maintenance Success (Green)</option>
              <option value="error">🔴 Critical Outage (Red)</option>
            </select>
          </div>

          <button onClick={() => handleSave('announcement', announceConfig)} disabled={saving} style={styles.saveBtn('#10b981')}>
            <Megaphone size={16} /> {saving ? 'Committing...' : 'Broadcast Announcement'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCMS;
