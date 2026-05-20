import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { 
  Save, LayoutTemplate, CreditCard, Megaphone, AlertCircle, 
  Sparkles, Layers, Eye, Quote, Sliders, Heading, FileText, HelpCircle
} from 'lucide-react';

const DEFAULT_HERO_CONFIG = {
  headline: 'The Next-Gen Pocket OS\nfor Smarter Retail.',
  subtitle: 'Completely paperless. Ultra-fast. WhatsApp-native.\nRun your entire retail shop, track expiry dates, send payment links, and see real profits directly from your phone.',
  buttonText: '🚀 Start Billing Free'
};

const DEFAULT_PRICING_CONFIG = {
  proPrice: '999',
  freeFeatures: 'Standard billing, 50 products catalog, Basic day book ledger',
  proFeatures: 'Unlimited digital invoices, WhatsApp receipt sharing, Proforma estimates, Delivery challans, Smart stock reorder alerts, Near-expiry warnings (90-day alert), Helper staff login locks, Unified customer outstanding book, Direct UPI WhatsApp payment reminders'
};

const DEFAULT_FEATURES_CONFIG = [
  {
    icon: 'Receipt',
    title: '🧾 Paperless Mobile Invoices',
    desc: 'Instantly generate crisp standard bills, estimate quotes, and challan presets straight from your phone. Share high-contrast receipts on WhatsApp with one click, saving thermal printer paper costs.',
    glow: 'rgba(16,185,129,0.1)'
  },
  {
    icon: 'Package',
    title: '📦 Smart Expiry & Batch Track',
    desc: 'Safeguard your profits from rotting inventory. Track batch numbers, configure automated low-stock warnings, and receive highly visible 90-day expiry notifications (amber/red alerts).',
    glow: 'rgba(251,191,36,0.1)'
  },
  {
    icon: 'Book',
    title: '📖 Today\'s Simple Day Book',
    desc: 'Forget complicated ledger sheets. View a unified daily cash register showing total cash-inflows (sales & settled credit) versus cash-outflows (supplier purchases) with clean net balance profit gauges.',
    glow: 'rgba(139,92,246,0.1)'
  },
  {
    icon: 'Wallet',
    title: '💸 Unified Credit Ledger',
    desc: 'Unify customer debts and distributor payables. Share gentle outstanding reminders directly to customer WhatsApp chats, pre-filled with automated upi:// payment deep-links.',
    glow: 'rgba(239,68,68,0.1)'
  },
  {
    icon: 'Lock',
    title: '🤝 Staff PIN-Lock Security',
    desc: 'Safely delegate walk-in billing to your store helpers. Give staff members secure 4-digit PIN access to scan barcodes and add cart items, while locking administration ledger files.',
    glow: 'rgba(59,130,246,0.1)'
  },
  {
    icon: 'RefreshCw',
    title: '🔄 Distributor Reordering',
    desc: 'Keep shelves filled. Connect directly with FMCG suppliers and restock low catalog items on credit. Orders automatically update supplier credit ledgers upon arrival.',
    glow: 'rgba(6,182,212,0.1)'
  }
];

const DEFAULT_INTERACTIVE3D_CONFIG = [
  {
    tag: '⚡ EXPRESS BILL',
    icon: 'Receipt',
    title: '30s Paperless Billing',
    desc: 'Select products and check out instantly on mobile. Automatically generates professional digital invoices and estimate documents shareable directly on WhatsApp.',
    glowColor: '#10b981'
  },
  {
    tag: '🛡️ STOCK HEALTH',
    icon: 'Package',
    title: 'Automated Expiry Badging',
    desc: 'Stay informed of inventory health. Automatically flags expired batches in red and near-expiry items within 90 days in amber. Never sell spoiled stock.',
    glowColor: '#fbbf24'
  },
  {
    tag: '📊 EASY LEDGER',
    icon: 'Book',
    title: 'Simplified Day Book',
    desc: 'View direct retail margins daily. Tracks sales income versus restock costs, presenting real-time net margins on a gorgeous circular profit gauge.',
    glowColor: '#8b5cf6'
  },
  {
    tag: '💸 SECURE UPI',
    icon: 'Wallet',
    title: 'Polite WhatsApp Reminders',
    desc: 'Access unified credit ledgers. Tap once to send WhatsApp outstanding reminders pre-filled with secure UPI payment links, letting debtors pay you instantly.',
    glowColor: '#06b6d4'
  }
];

const DEFAULT_PREVIEWS_CONFIG = [
  { id: 'bill', title: '🧾 Premium Digital Invoice', desc: 'Modern high-contrast billing format with dynamic store brand logos, direct UPI payment links, discount badges, and elegant digital footnotes.', border: '#10b981' },
  { id: 'estimate', title: '📋 Proforma Quote / Estimate', desc: 'Capture customer drafts and price estimations. Save them directly inside the Estimates Drawer, and load them into active shopping carts with one click.', border: '#fbbf24' },
  { id: 'challan', title: '🚚 Smart Delivery Challan', desc: 'Professional transport delivery sheet. Generates clear descriptions, items, and quantities for logistics and transit checks.', border: '#06b6d4' }
];

const DEFAULT_QUOTE_CONFIG = {
  teluguText: 'మీ షాపును స్మార్ట్ డిజిటల్ దుకాణంగా మార్చండి.',
  englishText: 'Elevate your retail business into a streamlined pocket-sized digital powerhouse.'
};

const DEFAULT_SECTION_HEADINGS = {
  playgroundTitle: 'Experience the 3D Motion Flow.',
  playgroundSubtitle: 'Tap below to watch how simple, interactive, and completely fluid MyStore OS makes your daily retail operations.',
  previewsTitle: 'Gorgeous Digital Formats.',
  previewsSubtitle: 'Create premium, styled invoices, quotations, and challans on mobile. Send them beautifully as high-resolution PDFs directly to customer WhatsApp chats.',
  featuresTitle: 'Engineered for Maximum Speed.',
  featuresSubtitle: 'Enjoy streamlined administrative utilities. Simple, high-value workflows tailored perfectly for small retail shopkeepers.',
  tactileTitle1: 'Responsive 3D Layout.',
  tactileTitle2: 'Feel the Tactile Control.',
  tactileSubtitle: 'Hover or slide your cursor over these feature cards to experience premium responsive 3D-motion. Zero lag, lightning-fast animations.'
};

const SUPPORTED_ICONS = [
  { value: 'Receipt', label: '🧾 Receipt Invoice' },
  { value: 'Package', label: '📦 Package Stock' },
  { value: 'Book', label: '📖 Day Book Ledger' },
  { value: 'Wallet', label: '💸 Wallet Credit' },
  { value: 'Lock', label: '🤝 Lock Security' },
  { value: 'RefreshCw', label: '🔄 Refresh Supply' },
  { value: 'Smartphone', label: '📱 Smartphone OS' },
  { value: 'Zap', label: '⚡ Zap Speed' }
];

const AdminCMS = () => {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [heroConfig, setHeroConfig] = useState(DEFAULT_HERO_CONFIG);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [announceConfig, setAnnounceConfig] = useState({ active: false, text: '🚨 System Update: New features added!', type: 'info' });
  const [featuresConfig, setFeaturesConfig] = useState(DEFAULT_FEATURES_CONFIG);
  const [interactive3dConfig, setInteractive3dConfig] = useState(DEFAULT_INTERACTIVE3D_CONFIG);
  const [previewsConfig, setPreviewsConfig] = useState(DEFAULT_PREVIEWS_CONFIG);
  const [quoteConfig, setQuoteConfig] = useState(DEFAULT_QUOTE_CONFIG);
  const [sectionHeadings, setSectionHeadings] = useState(DEFAULT_SECTION_HEADINGS);
  const [customCSS, setCustomCSS] = useState('');

  const loadCMS = useCallback(async () => {
    try {
      const hero = await api.getSiteConfig('hero', DEFAULT_HERO_CONFIG);
      const announce = await api.getSiteConfig('announcement', { active: false, text: '🚨 System Update: New features added!', type: 'info' });
      const pricing = await api.getSiteConfig('pricing', DEFAULT_PRICING_CONFIG);
      const features = await api.getSiteConfig('features', DEFAULT_FEATURES_CONFIG);
      const i3d = await api.getSiteConfig('interactive3d', DEFAULT_INTERACTIVE3D_CONFIG);
      const previews = await api.getSiteConfig('previews', DEFAULT_PREVIEWS_CONFIG);
      const quote = await api.getSiteConfig('quoteCallout', DEFAULT_QUOTE_CONFIG);
      const headings = await api.getSiteConfig('sectionHeadings', DEFAULT_SECTION_HEADINGS);
      const css = await api.getSiteConfig('customCSS', '');
      
      setHeroConfig(hero);
      setAnnounceConfig(announce);
      setPricingConfig(pricing);
      setFeaturesConfig(features);
      setInteractive3dConfig(i3d);
      setPreviewsConfig(previews);
      setQuoteConfig(quote);
      setSectionHeadings(headings);
      setCustomCSS(css);
    } catch {
      toast.error('Failed to sync content parameters');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCMS();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCMS]);

  const handleSave = async (key, value) => {
    setSaving(true);
    try {
      await api.saveSiteConfig(key, value);
      if (key === 'customCSS') {
        window.dispatchEvent(new CustomEvent('custom-css-updated', { detail: value }));
      }
      if (key === 'announcement') {
        if (value.active) {
          await api.saveAnnouncement({
            text: value.text,
            type: value.type
          });
        } else {
          await api.clearAnnouncements();
        }
      }
      toast.success(`${key.toUpperCase()} configurations committed to production!`);
    } catch {
      toast.error(`Failed to commit ${key} changes`);
    } finally {
      setSaving(false);
    }
  };

  const styles = {
    glassCard: {
      background: 'linear-gradient(135deg, rgba(20, 25, 46, 0.45) 0%, rgba(10, 13, 26, 0.6) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '24px',
      padding: '32px',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(20px)',
      color: '#fff'
    },
    tabBtn: (active, color) => ({
      padding: '12px 18px',
      background: active ? color : 'rgba(255,255,255,0.02)',
      border: '1px solid ' + (active ? 'transparent' : 'rgba(255,255,255,0.05)'),
      borderRadius: '12px',
      color: active ? '#000' : '#94a3b8',
      fontSize: '13.5px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: active ? '0 8px 20px ' + color + '35' : 'none',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      whiteSpace: 'nowrap'
    }),
    label: {
      display: 'block',
      fontSize: '11px',
      color: '#94a3b8',
      marginBottom: '6px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: 'rgba(5, 7, 14, 0.65)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      color: '#fff',
      fontSize: '13.5px',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s',
      fontFamily: 'inherit'
    },
    cardEditor: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      position: 'relative',
      overflow: 'hidden'
    },
    cardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '20px',
      marginTop: '10px'
    },
    saveBtn: (color) => ({
      width: '100%',
      background: color,
      color: '#030712',
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
      marginTop: '24px',
      transition: 'all 0.2s',
      letterSpacing: '0.5px'
    })
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', color: '#fbbf24', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>
        <Sparkles size={24} style={{ display: 'block', margin: '0 auto 12px', animation: 'spin 2s linear infinite' }} />
        Syncing global landing page configurations...
      </div>
    );
  }

  return (
    <div style={styles.glassCard}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: "'Outfit', sans-serif", fontWeight: 900, margin: 0, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #fff 40%, #fbbf24 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Website CMS (Live Editor)
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Manage the entire 3D interactive landing page copy, features showcase grid, invoice presets, Telugu quote callout, and headlines.
          </p>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '8px 16px', borderRadius: '30px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} /> Direct Database Safe
        </div>
      </div>
      
      {/* Dynamic Tab Switcher Grid */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
        <button onClick={() => setActiveTab('hero')} style={styles.tabBtn(activeTab === 'hero', '#fbbf24')}>
          <LayoutTemplate size={15} /> Hero & Quotes
        </button>
        <button onClick={() => setActiveTab('headings')} style={styles.tabBtn(activeTab === 'headings', '#8b5cf6')}>
          <Heading size={15} /> Section Titles
        </button>
        <button onClick={() => setActiveTab('features')} style={styles.tabBtn(activeTab === 'features', '#10b981')}>
          <Layers size={15} /> Features Grid
        </button>
        <button onClick={() => setActiveTab('interactive3d')} style={styles.tabBtn(activeTab === 'interactive3d', '#06b6d4')}>
          <Sliders size={15} /> Cinematic 3D Cards
        </button>
        <button onClick={() => setActiveTab('previews')} style={styles.tabBtn(activeTab === 'previews', '#f43f5e')}>
          <Eye size={15} /> Invoice Presets
        </button>
        <button onClick={() => setActiveTab('pricing')} style={styles.tabBtn(activeTab === 'pricing', '#3b82f6')}>
          <CreditCard size={15} /> Pricing Plans
        </button>
        <button onClick={() => setActiveTab('announce')} style={styles.tabBtn(activeTab === 'announce', '#10b981')}>
          <Megaphone size={15} /> Global Broadcast
        </button>
        <button onClick={() => setActiveTab('css')} style={styles.tabBtn(activeTab === 'css', '#ec4899')}>
          <Sparkles size={15} /> Custom CSS
        </button>
      </div>

      {/* TAB 1: HERO & QUOTES */}
      {activeTab === 'hero' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#fbbf24', fontSize: '14px', fontWeight: 'bold' }}>Hero Layout Context & Regional Callout</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                This section manages the very first screen users see. Customize the primary cinematic headline, paragraph pitch, and Telugu translation quote cards below.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 2' }}>
              <div>
                <label style={styles.label}>Primary Cinematic Headline (Use \n for linebreaks)</label>
                <textarea 
                  value={heroConfig.headline} 
                  onChange={e => setHeroConfig({...heroConfig, headline: e.target.value})} 
                  style={{ ...styles.input, height: '70px' }} 
                />
              </div>
              
              <div>
                <label style={styles.label}>Headline Subtitle / Pitch Copy (Use \n for linebreaks)</label>
                <textarea 
                  value={heroConfig.subtitle} 
                  onChange={e => setHeroConfig({...heroConfig, subtitle: e.target.value})} 
                  style={{ ...styles.input, height: '90px', resize: 'vertical' }} 
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
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
              <Quote size={16} /> Regional Telugu Quote Callout
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={styles.label}>Telugu Text Translation</label>
                <input 
                  type="text" 
                  value={quoteConfig.teluguText} 
                  onChange={e => setQuoteConfig({...quoteConfig, teluguText: e.target.value})} 
                  style={styles.input} 
                />
              </div>
              <div>
                <label style={styles.label}>English Subtitle Translation</label>
                <input 
                  type="text" 
                  value={quoteConfig.englishText} 
                  onChange={e => setQuoteConfig({...quoteConfig, englishText: e.target.value})} 
                  style={styles.input} 
                />
              </div>
            </div>
          </div>

          <button onClick={async () => {
            await handleSave('hero', heroConfig);
            await handleSave('quoteCallout', quoteConfig);
          }} disabled={saving} style={styles.saveBtn('#fbbf24')}>
            <Save size={16} /> {saving ? 'Committing changes...' : 'Save Hero & Quotes'}
          </button>
        </div>
      )}

      {/* TAB 2: SECTION TITLES */}
      {activeTab === 'headings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Heading size={20} color="#8b5cf6" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#a78bfa', fontSize: '14px', fontWeight: 'bold' }}>Dynamic Section Headings</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Control all core text blocks and subtitles that direct user attention as they scroll down the cinematic landing page.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={styles.label}>Interactive 3D Flow Title</label>
              <input 
                type="text" 
                value={sectionHeadings.playgroundTitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, playgroundTitle: e.target.value})} 
                style={styles.input} 
              />
            </div>
            <div>
              <label style={styles.label}>Interactive 3D Flow Subtitle</label>
              <input 
                type="text" 
                value={sectionHeadings.playgroundSubtitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, playgroundSubtitle: e.target.value})} 
                style={styles.input} 
              />
            </div>

            <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }} />

            <div>
              <label style={styles.label}>Invoice Previews Title</label>
              <input 
                type="text" 
                value={sectionHeadings.previewsTitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, previewsTitle: e.target.value})} 
                style={styles.input} 
              />
            </div>
            <div>
              <label style={styles.label}>Invoice Previews Subtitle</label>
              <input 
                type="text" 
                value={sectionHeadings.previewsSubtitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, previewsSubtitle: e.target.value})} 
                style={styles.input} 
              />
            </div>

            <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }} />

            <div>
              <label style={styles.label}>Features Showcase Grid Title</label>
              <input 
                type="text" 
                value={sectionHeadings.featuresTitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, featuresTitle: e.target.value})} 
                style={styles.input} 
              />
            </div>
            <div>
              <label style={styles.label}>Features Showcase Grid Subtitle</label>
              <input 
                type="text" 
                value={sectionHeadings.featuresSubtitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, featuresSubtitle: e.target.value})} 
                style={styles.input} 
              />
            </div>

            <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }} />

            <div>
              <label style={styles.label}>Tactile Motion Card Title Line 1</label>
              <input 
                type="text" 
                value={sectionHeadings.tactileTitle1} 
                onChange={e => setSectionHeadings({...sectionHeadings, tactileTitle1: e.target.value})} 
                style={styles.input} 
              />
            </div>
            <div>
              <label style={styles.label}>Tactile Motion Card Title Line 2</label>
              <input 
                type="text" 
                value={sectionHeadings.tactileTitle2} 
                onChange={e => setSectionHeadings({...sectionHeadings, tactileTitle2: e.target.value})} 
                style={styles.input} 
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>Tactile Motion Cards Subtitle / Description</label>
              <textarea 
                value={sectionHeadings.tactileSubtitle} 
                onChange={e => setSectionHeadings({...sectionHeadings, tactileSubtitle: e.target.value})} 
                style={{ ...styles.input, height: '50px' }} 
              />
            </div>
          </div>

          <button onClick={() => handleSave('sectionHeadings', sectionHeadings)} disabled={saving} style={styles.saveBtn('#8b5cf6')}>
            <Save size={16} /> {saving ? 'Committing Changes...' : 'Save Section Titles'}
          </button>
        </div>
      )}

      {/* TAB 3: FEATURES GRID */}
      {activeTab === 'features' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Layers size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#34d399', fontSize: '14px', fontWeight: 'bold' }}>Features Showcase Editor</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Modify the 6 tactical utility cards representing primary mobile benefits (invoicing, stock reorder, ledgers, secure lock, near-expiry alerts).
              </p>
            </div>
          </div>

          <div style={styles.cardGrid}>
            {featuresConfig.map((item, index) => (
              <div key={index} style={styles.cardEditor}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>Feature Card #{index + 1}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.glow.replace(/rgba\((\d+,\s*\d+,\s*\d+),.*/, 'rgb($1)') || '#10b981' }} />
                </div>

                <div>
                  <label style={styles.label}>Card Title</label>
                  <input 
                    type="text" 
                    value={item.title} 
                    onChange={e => {
                      const copy = [...featuresConfig];
                      copy[index].title = e.target.value;
                      setFeaturesConfig(copy);
                    }}
                    style={styles.input} 
                  />
                </div>

                <div>
                  <label style={styles.label}>Selected Lucide Icon</label>
                  <select 
                    value={item.icon} 
                    onChange={e => {
                      const copy = [...featuresConfig];
                      copy[index].icon = e.target.value;
                      setFeaturesConfig(copy);
                    }}
                    style={{
                      ...styles.input,
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cbd5e1\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '14px'
                    }}
                  >
                    {SUPPORTED_ICONS.map(i => (
                      <option key={i.value} value={i.value} style={{ background: '#090d16', color: '#fff' }}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Description Text</label>
                  <textarea 
                    value={item.desc} 
                    onChange={e => {
                      const copy = [...featuresConfig];
                      copy[index].desc = e.target.value;
                      setFeaturesConfig(copy);
                    }}
                    style={{ ...styles.input, height: '80px', resize: 'none' }} 
                  />
                </div>

                <div>
                  <label style={styles.label}>Neon Glow Color (RGBA string)</label>
                  <input 
                    type="text" 
                    value={item.glow} 
                    onChange={e => {
                      const copy = [...featuresConfig];
                      copy[index].glow = e.target.value;
                      setFeaturesConfig(copy);
                    }}
                    placeholder="rgba(16,185,129,0.1)"
                    style={styles.input} 
                  />
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => handleSave('features', featuresConfig)} disabled={saving} style={styles.saveBtn('#10b981')}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Features Grid'}
          </button>
        </div>
      )}

      {/* TAB 4: CINEMATIC 3D CARDS */}
      {activeTab === 'interactive3d' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Sliders size={20} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#22d3ee', fontSize: '14px', fontWeight: 'bold' }}>Cinematic 3D Cards Editor</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Control the 4 high-fidelity 3D motion cards with interactive spotlight radial gradients and premium neon hover states.
              </p>
            </div>
          </div>

          <div style={styles.cardGrid}>
            {interactive3dConfig.map((item, index) => (
              <div key={index} style={styles.cardEditor}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#06b6d4' }}>Spotlight Card #{index + 1}</span>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: item.glowColor || '#06b6d4' }} />
                </div>

                <div>
                  <label style={styles.label}>Top Mini Badge Tag</label>
                  <input 
                    type="text" 
                    value={item.tag} 
                    onChange={e => {
                      const copy = [...interactive3dConfig];
                      copy[index].tag = e.target.value;
                      setInteractive3dConfig(copy);
                    }}
                    style={styles.input} 
                  />
                </div>

                <div>
                  <label style={styles.label}>Card Title</label>
                  <input 
                    type="text" 
                    value={item.title} 
                    onChange={e => {
                      const copy = [...interactive3dConfig];
                      copy[index].title = e.target.value;
                      setInteractive3dConfig(copy);
                    }}
                    style={styles.input} 
                  />
                </div>

                <div>
                  <label style={styles.label}>Lucide Icon</label>
                  <select 
                    value={item.icon} 
                    onChange={e => {
                      const copy = [...interactive3dConfig];
                      copy[index].icon = e.target.value;
                      setInteractive3dConfig(copy);
                    }}
                    style={{
                      ...styles.input,
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cbd5e1\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '14px'
                    }}
                  >
                    {SUPPORTED_ICONS.map(i => (
                      <option key={i.value} value={i.value} style={{ background: '#090d16', color: '#fff' }}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Description Copy</label>
                  <textarea 
                    value={item.desc} 
                    onChange={e => {
                      const copy = [...interactive3dConfig];
                      copy[index].desc = e.target.value;
                      setInteractive3dConfig(copy);
                    }}
                    style={{ ...styles.input, height: '70px', resize: 'none' }} 
                  />
                </div>

                <div>
                  <label style={styles.label}>Highlight Hex Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={item.glowColor.startsWith('#') && item.glowColor.length === 7 ? item.glowColor : '#06b6d4'} 
                      onChange={e => {
                        const copy = [...interactive3dConfig];
                        copy[index].glowColor = e.target.value;
                        setInteractive3dConfig(copy);
                      }}
                      style={{ border: 'none', background: 'none', width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <input 
                      type="text" 
                      value={item.glowColor} 
                      onChange={e => {
                        const copy = [...interactive3dConfig];
                        copy[index].glowColor = e.target.value;
                        setInteractive3dConfig(copy);
                      }}
                      style={styles.input} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => handleSave('interactive3d', interactive3dConfig)} disabled={saving} style={styles.saveBtn('#06b6d4')}>
            <Save size={16} /> {saving ? 'Committing 3D Spotlight...' : 'Save Cinematic 3D cards'}
          </button>
        </div>
      )}

      {/* TAB 5: INVOICE PRESETS */}
      {activeTab === 'previews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(244,63,94,0.03)', border: '1px solid rgba(244,63,94,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Eye size={20} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#fb7185', fontSize: '14px', fontWeight: 'bold' }}>Invoice Formats Showcase</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Edit descriptive parameters for the 3 premium billing formats (Tax Invoice, Proforma Estimate, Delivery Challan).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {previewsConfig.map((item, index) => (
              <div key={item.id} style={{ ...styles.cardEditor, borderLeft: `4px solid ${item.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#f43f5e' }}>Format Preset: {item.id}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={styles.label}>Display Title</label>
                    <input 
                      type="text" 
                      value={item.title} 
                      onChange={e => {
                        const copy = [...previewsConfig];
                        copy[index].title = e.target.value;
                        setPreviewsConfig(copy);
                      }}
                      style={styles.input} 
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Accent Accent color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="color" 
                        value={item.border.startsWith('#') && item.border.length === 7 ? item.border : '#f43f5e'} 
                        onChange={e => {
                          const copy = [...previewsConfig];
                          copy[index].border = e.target.value;
                          setPreviewsConfig(copy);
                        }}
                        style={{ border: 'none', background: 'none', width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <input 
                        type="text" 
                        value={item.border} 
                        onChange={e => {
                          const copy = [...previewsConfig];
                          copy[index].border = e.target.value;
                          setPreviewsConfig(copy);
                        }}
                        style={styles.input} 
                      />
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={styles.label}>Description Text</label>
                    <textarea 
                      value={item.desc} 
                      onChange={e => {
                        const copy = [...previewsConfig];
                        copy[index].desc = e.target.value;
                        setPreviewsConfig(copy);
                      }}
                      style={{ ...styles.input, height: '60px', resize: 'vertical' }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => handleSave('previews', previewsConfig)} disabled={saving} style={styles.saveBtn('#f43f5e')}>
            <Save size={16} /> {saving ? 'Saving Preset Params...' : 'Save Invoice Presets'}
          </button>
        </div>
      )}

      {/* TAB 6: PRICING PLANS */}
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

      {/* TAB 7: BROADCAST ANNOUNCEMENT */}
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
                style={{ width: 0, height: 0, opacity: 0 }} 
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
              <option value="info" style={{ background: '#090d16' }}>🔵 Information (Blue)</option>
              <option value="warning" style={{ background: '#090d16' }}>🟡 Attention Alert (Yellow)</option>
              <option value="success" style={{ background: '#090d16' }}>🟢 Maintenance Success (Green)</option>
              <option value="error" style={{ background: '#090d16' }}>🔴 Critical Outage (Red)</option>
            </select>
          </div>

          <button onClick={() => handleSave('announcement', announceConfig)} disabled={saving} style={styles.saveBtn('#10b981')}>
            <Megaphone size={16} /> {saving ? 'Committing...' : 'Broadcast Announcement'}
          </button>
        </div>
      )}

      {/* TAB 8: CUSTOM STYLING (CSS) */}
      {activeTab === 'css' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(236,72,153,0.03)', border: '1px solid rgba(236,72,153,0.1)', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Sparkles size={20} color="#ec4899" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: 0, color: '#f472b6', fontSize: '14px', fontWeight: 'bold' }}>Custom Styles & CSS Sheet</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Directly inject custom CSS rules, layout configurations, class overrides, or styling variables live into production pages.
              </p>
            </div>
          </div>

          <div>
            <label style={styles.label}>Custom CSS Code Block</label>
            <textarea 
              value={customCSS} 
              onChange={e => setCustomCSS(e.target.value)} 
              placeholder={`/* Inject Custom CSS Styles here */\n:root {\n  --neon-glow-primary: #fbbf24;\n}\n\nbody {\n  /* Your custom style rule overrides */\n}`}
              style={{
                ...styles.input,
                height: '240px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#34d399',
                background: 'rgba(5, 7, 14, 0.85)',
                border: '1px solid rgba(236,72,153,0.25)',
                padding: '20px'
              }} 
            />
          </div>

          <button onClick={() => handleSave('customCSS', customCSS)} disabled={saving} style={styles.saveBtn('#ec4899')}>
            <Save size={16} /> {saving ? 'Injecting CSS Sheet...' : 'Inject CSS Sheet Live'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCMS;
