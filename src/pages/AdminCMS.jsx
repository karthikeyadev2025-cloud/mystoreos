import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

const AdminCMS = () => {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  
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
      toast.error('Failed to load CMS data');
    }
    setLoading(false);
  };

  const handleSave = async (key, value) => {
    try {
      await api.saveSiteConfig(key, value);
      toast.success(`${key.toUpperCase()} updated successfully!`);
    } catch(err) {
      toast.error(`Failed to save ${key}`);
    }
  };

  if (loading) return <div style={{padding: 20, color: '#fff'}}>Loading CMS...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', color: '#fff' }}>Website CMS (Live Editor)</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('hero')} style={{ padding: '8px 16px', background: activeTab === 'hero' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Header & Hero</button>
        <button onClick={() => setActiveTab('pricing')} style={{ padding: '8px 16px', background: activeTab === 'pricing' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Pricing</button>
        <button onClick={() => setActiveTab('announce')} style={{ padding: '8px 16px', background: activeTab === 'announce' ? '#f59e0b' : '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Announcements</button>
      </div>

      {/* HERO TAB */}
      {activeTab === 'hero' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Landing Page Hero Section</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Headline</label>
            <input type="text" value={heroConfig.headline} onChange={e => setHeroConfig({...heroConfig, headline: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Subtitle</label>
            <textarea value={heroConfig.subtitle} onChange={e => setHeroConfig({...heroConfig, subtitle: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', height: '80px' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Button Text</label>
            <input type="text" value={heroConfig.buttonText} onChange={e => setHeroConfig({...heroConfig, buttonText: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
          </div>

          <button onClick={() => handleSave('hero', heroConfig)} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Save Changes (Live Instantly)</button>
        </div>
      )}

      {/* PRICING TAB */}
      {activeTab === 'pricing' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Pricing Plans Configuration</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Pro Plan Price (₹)</label>
            <input type="text" value={pricingConfig.proPrice} onChange={e => setPricingConfig({...pricingConfig, proPrice: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Free Plan Features (Comma separated)</label>
            <textarea value={pricingConfig.freeFeatures} onChange={e => setPricingConfig({...pricingConfig, freeFeatures: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', height: '60px' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Pro Plan Features (Comma separated)</label>
            <textarea value={pricingConfig.proFeatures} onChange={e => setPricingConfig({...pricingConfig, proFeatures: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', height: '80px' }} />
          </div>

          <button onClick={() => handleSave('pricing', pricingConfig)} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Save Pricing</button>
        </div>
      )}

      {/* ANNOUNCEMENT TAB */}
      {activeTab === 'announce' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Global Announcement Banner</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>This will be displayed at the top of every Shop Dashboard when active.</p>
          
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" checked={announceConfig.active} onChange={e => setAnnounceConfig({...announceConfig, active: e.target.checked})} style={{ width: '20px', height: '20px' }} />
            <label style={{ color: '#fff', fontWeight: 'bold' }}>Banner is ACTIVE</label>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Announcement Text</label>
            <textarea value={announceConfig.text} onChange={e => setAnnounceConfig({...announceConfig, text: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', height: '80px' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Color Theme</label>
            <select value={announceConfig.type} onChange={e => setAnnounceConfig({...announceConfig, type: e.target.value})} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}>
              <option value="info">Blue (Info)</option>
              <option value="warning">Yellow (Warning)</option>
              <option value="success">Green (Success)</option>
              <option value="error">Red (Critical)</option>
            </select>
          </div>

          <button onClick={() => handleSave('announcement', announceConfig)} style={{ width: '100%', background: '#f59e0b', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📢 Publish Announcement</button>
        </div>
      )}
    </div>
  );
};

export default AdminCMS;
