import { useState, useEffect } from 'react';
import { Save, Globe, FileText, Megaphone, X, CreditCard, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useSiteConfig } from '../../lib/siteConfig';
import { toast } from 'react-toastify';

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', marginBottom: '20px' },
  label: { color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%' },
  textarea: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%', resize: 'vertical', minHeight: '80px' },
  row: { marginBottom: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  saveBtn: (busy) => ({ background: busy ? '#64748b' : '#f43f5e', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
  sectionTitle: { color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748b', fontSize: '12px', marginBottom: '20px' },
  badge: (type) => {
    const colors = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', error: '#ef4444' };
    return { background: `${colors[type] || '#3b82f6'}22`, color: colors[type] || '#3b82f6', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 };
  },
};

const ANN_TYPES = ['info', 'warning', 'success', 'error'];

function SectionHeader({ icon: Icon, title, sub, color = '#f43f5e' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
      <div style={{ background: `${color}22`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
      <div><div style={S.sectionTitle}>{title}</div><div style={S.sectionSub}>{sub}</div></div>
    </div>
  );
}

export default function TabCMS() {
  const { config, updateConfigs } = useSiteConfig();
  const [busy, setBusy] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [annText, setAnnText] = useState('');
  const [annType, setAnnType] = useState('info');

  const [branding, setBranding] = useState({ siteName: '', siteTagline: '', siteLogo: '', faviconUrl: '' });
  const [landing, setLanding] = useState({ heroHeadline: '', heroSubheadline: '', heroCtaText: '', heroCtaUrl: '' });
  const [seo, setSeo] = useState({ metaDescription: '', metaKeywords: '' });
  const [social, setSocial] = useState({ instagramUrl: '', twitterUrl: '' });
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setBranding({ siteName: config.siteName || '', siteTagline: config.siteTagline || '', siteLogo: config.siteLogo || '', faviconUrl: config.faviconUrl || '' });
      setLanding({ heroHeadline: config.heroHeadline || '', heroSubheadline: config.heroSubheadline || '', heroCtaText: config.heroCtaText || '', heroCtaUrl: config.heroCtaUrl || '' });
      setSeo({ metaDescription: config.metaDescription || '', metaKeywords: config.metaKeywords || '' });
      setSocial({ instagramUrl: config.instagramUrl || '', twitterUrl: config.twitterUrl || '' });
    }, 0);
    return () => clearTimeout(t);
  }, [config]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.getAnnouncements().then(setAnnouncements).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    api.getSubscriptionPlans().then(setPlans).catch(() => {});
  }, []);

  const saveSection = async (key, fn) => {
    setBusy(b => ({ ...b, [key]: true }));
    try { await fn(); toast.success('Saved'); }
    catch { toast.error('Save failed'); }
    finally { setBusy(b => ({ ...b, [key]: false })); }
  };

  const saveBranding = () => saveSection('branding', async () => {
    await updateConfigs(branding);
    await api.logAdminAction('update_branding', 'cms', null, JSON.stringify(branding));
  });

  const saveLanding = () => saveSection('landing', async () => {
    await updateConfigs(landing);
    await api.logAdminAction('update_landing', 'cms', null, null);
  });

  const saveSEO = () => saveSection('seo', async () => {
    await updateConfigs({ ...seo, ...social });
    await api.logAdminAction('update_seo', 'cms', null, null);
  });

  const sendAnnouncement = () => saveSection('ann', async () => {
    if (!annText.trim()) { toast.error('Announcement text required'); return; }
    await api.saveAnnouncement({ text: annText, type: annType });
    await updateConfigs({ announcementText: annText, announcementType: annType, announcementActive: true });
    await api.logAdminAction('send_announcement', 'cms', null, annText);
    setAnnText('');
    setAnnouncements(await api.getAnnouncements());
    toast.success('Announcement sent!');
  });

  const clearAnnouncements = () => saveSection('clearAnn', async () => {
    await api.clearAnnouncements();
    await updateConfigs({ announcementActive: false, announcementText: '' });
    setAnnouncements([]);
  });

  const savePlans = () => saveSection('plans', async () => {
    await api.saveSubscriptionPlans(plans);
    await api.logAdminAction('update_plans', 'cms', null, null);
  });

  const updatePlan = (idx, field, value) => setPlans(ps => ps.map((p, i) => i === idx ? { ...p, [field]: field === 'price' ? Number(value) : value } : p));

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Website & CMS</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Manage landing page content, branding, and announcements</p>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Megaphone} title="Announcement Banner" sub="Pinned banner shown at the top of every page — dismissable by users" color="#f59e0b" />
        {announcements.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {announcements.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={S.badge(a.type)}>{a.type}</span>
                <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1 }}>{a.text}</span>
                <button onClick={clearAnnouncements} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={S.row}>
          <label style={S.label}>Banner Message</label>
          <textarea value={annText} onChange={e => setAnnText(e.target.value)} placeholder="e.g. We just launched GST billing! Upgrade to Enterprise to try it." style={S.textarea} rows={2} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {ANN_TYPES.map(t => (
            <button key={t} onClick={() => setAnnType(t)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${annType === t ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`, background: annType === t ? 'rgba(244,63,94,0.12)' : 'transparent', color: annType === t ? '#f43f5e' : '#94a3b8', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Outfit, sans-serif' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={sendAnnouncement} disabled={busy.ann} style={S.saveBtn(busy.ann)}><Megaphone size={14} />{busy.ann ? 'Sending...' : 'Broadcast Announcement'}</button>
          {announcements.length > 0 && <button onClick={clearAnnouncements} disabled={busy.clearAnn} style={{ ...S.saveBtn(busy.clearAnn), background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}><X size={14} />Clear All</button>}
        </div>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Globe} title="Branding" sub="Site name, tagline, and logo used across the platform" color="#8b5cf6" />
        <div style={S.grid2}>
          <div style={S.row}>
            <label style={S.label}>Site Name</label>
            <input value={branding.siteName} onChange={e => setBranding(b => ({ ...b, siteName: e.target.value }))} placeholder="MyStore OS" style={S.input} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Tagline</label>
            <input value={branding.siteTagline} onChange={e => setBranding(b => ({ ...b, siteTagline: e.target.value }))} placeholder="Run your shop, own your data." style={S.input} />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.row}>
            <label style={S.label}>Logo URL</label>
            <input value={branding.siteLogo} onChange={e => setBranding(b => ({ ...b, siteLogo: e.target.value }))} placeholder="https://..." style={S.input} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Favicon URL</label>
            <input value={branding.faviconUrl} onChange={e => setBranding(b => ({ ...b, faviconUrl: e.target.value }))} placeholder="https://..." style={S.input} />
          </div>
        </div>
        <button onClick={saveBranding} disabled={busy.branding} style={S.saveBtn(busy.branding)}><Save size={14} />{busy.branding ? 'Saving...' : 'Save Branding'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={FileText} title="Landing Page Content" sub="Hero section text and call-to-action button" color="#10b981" />
        <div style={S.row}>
          <label style={S.label}>Hero Headline</label>
          <input value={landing.heroHeadline} onChange={e => setLanding(l => ({ ...l, heroHeadline: e.target.value }))} placeholder="Run Your Shop. Own Your Data." style={S.input} />
        </div>
        <div style={S.row}>
          <label style={S.label}>Hero Subheadline</label>
          <textarea value={landing.heroSubheadline} onChange={e => setLanding(l => ({ ...l, heroSubheadline: e.target.value }))} placeholder="The complete POS & ERP for Indian kirana shops." style={S.textarea} rows={2} />
        </div>
        <div style={S.grid2}>
          <div style={S.row}>
            <label style={S.label}>CTA Button Text</label>
            <input value={landing.heroCtaText} onChange={e => setLanding(l => ({ ...l, heroCtaText: e.target.value }))} placeholder="Start Free Trial" style={S.input} />
          </div>
          <div style={S.row}>
            <label style={S.label}>CTA Button URL</label>
            <input value={landing.heroCtaUrl} onChange={e => setLanding(l => ({ ...l, heroCtaUrl: e.target.value }))} placeholder="/register" style={S.input} />
          </div>
        </div>
        <button onClick={saveLanding} disabled={busy.landing} style={S.saveBtn(busy.landing)}><Save size={14} />{busy.landing ? 'Saving...' : 'Save Landing Page'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Globe} title="SEO & Social" sub="Meta tags and social profile links" color="#3b82f6" />
        <div style={S.row}>
          <label style={S.label}>Meta Description</label>
          <textarea value={seo.metaDescription} onChange={e => setSeo(s => ({ ...s, metaDescription: e.target.value }))} placeholder="MyStore OS — digital billing, inventory, GST, and more for Indian small businesses." style={S.textarea} rows={2} />
        </div>
        <div style={S.row}>
          <label style={S.label}>Meta Keywords (comma-separated)</label>
          <input value={seo.metaKeywords} onChange={e => setSeo(s => ({ ...s, metaKeywords: e.target.value }))} placeholder="kirana, billing, POS, inventory, GST, India" style={S.input} />
        </div>
        <div style={S.grid2}>
          <div style={S.row}>
            <label style={S.label}>Instagram URL</label>
            <input value={social.instagramUrl} onChange={e => setSocial(s => ({ ...s, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." style={S.input} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Twitter / X URL</label>
            <input value={social.twitterUrl} onChange={e => setSocial(s => ({ ...s, twitterUrl: e.target.value }))} placeholder="https://x.com/..." style={S.input} />
          </div>
        </div>
        <button onClick={saveSEO} disabled={busy.seo} style={S.saveBtn(busy.seo)}><Save size={14} />{busy.seo ? 'Saving...' : 'Save SEO & Social'}</button>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <SectionHeader icon={CreditCard} title="Subscription Plans" sub="Edit plan names, prices, and descriptions shown on /pricing" color="#f43f5e" />
          <a href="/pricing" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8b5cf6', fontSize: '12px', textDecoration: 'none', flexShrink: 0, marginTop: '2px' }}>
            Preview <ExternalLink size={12} />
          </a>
        </div>
        {plans.map((plan, idx) => (
          <div key={plan.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{plan.id}</div>
            <div style={S.grid2}>
              <div style={S.row}>
                <label style={S.label}>Plan Name</label>
                <input value={plan.name} onChange={e => updatePlan(idx, 'name', e.target.value)} style={S.input} />
              </div>
              <div style={S.row}>
                <label style={S.label}>Price (₹/month)</label>
                <input type="number" value={plan.price} onChange={e => updatePlan(idx, 'price', e.target.value)} style={S.input} />
              </div>
            </div>
            <div style={S.row}>
              <label style={S.label}>Description</label>
              <textarea value={plan.description || ''} onChange={e => updatePlan(idx, 'description', e.target.value)} style={S.textarea} rows={2} />
            </div>
          </div>
        ))}
        {plans.length > 0 && (
          <button onClick={savePlans} disabled={busy.plans} style={S.saveBtn(busy.plans)}><Save size={14} />{busy.plans ? 'Saving...' : 'Save Plans'}</button>
        )}
      </div>
    </div>

      {/* ── App Store & Social Links ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '20px' }}>📱</span>
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>App Store & Social Links</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>These appear on the landing page. Leave blank to hide.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px' }}>
          {[
            { key: 'playStoreUrl',  label: '🤖 Google Play Store URL',  placeholder: 'https://play.google.com/store/apps/details?id=in.mystoreos.app' },
            { key: 'appStoreUrl',   label: '🍎 Apple App Store URL',     placeholder: 'https://apps.apple.com/in/app/mystore-os/id...' },
            { key: 'instagramUrl',  label: '📸 Instagram URL',            placeholder: 'https://instagram.com/mystoreos' },
            { key: 'facebookUrl',   label: '👥 Facebook Page URL',        placeholder: 'https://facebook.com/mystoreos' },
            { key: 'twitterUrl',    label: '🐦 X / Twitter URL',          placeholder: 'https://x.com/mystoreos' },
            { key: 'youtubeUrl',    label: '▶️ YouTube Channel URL',      placeholder: 'https://youtube.com/@mystoreos' },
            { key: 'linkedinUrl',   label: '💼 LinkedIn Page URL',        placeholder: 'https://linkedin.com/company/mystoreos' },
            { key: 'whatsappUrl',   label: '💬 WhatsApp Support URL',     placeholder: 'https://wa.me/918885490495' },
          ].map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                {field.label}
              </label>
              <input
                type="url"
                value={cfg[field.key] || ''}
                onChange={e => setCfg(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '9px 12px', fontSize: '12px', fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{ marginTop: '20px', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Outfit, sans-serif' }}
        >
          {saving ? 'Saving...' : '💾 Save App & Social Links'}
        </button>
      </div>


  );
}
