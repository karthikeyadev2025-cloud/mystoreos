import { useState, useEffect } from 'react';
import { Save, Globe, FileText, Megaphone, X, CreditCard, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useSiteConfig } from '../../lib/siteConfig';
import { toast } from 'react-toastify';

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  label: { color: '#475569', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  input: { background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#0F172A', padding: '10px 12px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none', width: '100%', transition: 'all 0.15s' },
  textarea: { background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#0F172A', padding: '10px 12px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none', width: '100%', resize: 'vertical', minHeight: '80px', transition: 'all 0.15s' },
  row: { marginBottom: '16px' },
  saveBtn: (busy) => ({ background: busy ? '#94A3B8' : '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)' }),
  sectionTitle: { color: '#0F172A', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748B', fontSize: '12px', marginBottom: '20px' },
  badge: (type) => {
    const colors = { info: '#3B82F6', warning: '#F59E0B', success: '#10B981', error: '#EF4444' };
    return { background: `${colors[type] || '#3B82F6'}15`, color: colors[type] || '#3B82F6', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 };
  },
};

const ANN_TYPES = ['info', 'warning', 'success', 'error'];

function SectionHeader({ icon: Icon, title, sub, color = '#4F46E5' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
      <div style={{ background: `${color}15`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
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
  const [cfg, setCfg] = useState({ playStoreUrl: '', appStoreUrl: '', instagramUrl: '', facebookUrl: '', twitterUrl: '', youtubeUrl: '', linkedinUrl: '', whatsappUrl: '' });
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setBranding({ siteName: config.siteName || '', siteTagline: config.siteTagline || '', siteLogo: config.siteLogo || '', faviconUrl: config.faviconUrl || '' });
      setLanding({ heroHeadline: config.heroHeadline || '', heroSubheadline: config.heroSubheadline || '', heroCtaText: config.heroCtaText || '', heroCtaUrl: config.heroCtaUrl || '' });
      setSeo({ metaDescription: config.metaDescription || '', metaKeywords: config.metaKeywords || '' });
      setSocial({ instagramUrl: config.instagramUrl || '', twitterUrl: config.twitterUrl || '' });
      setCfg({ playStoreUrl: config.playStoreUrl || '', appStoreUrl: config.appStoreUrl || '', instagramUrl: config.instagramUrl || '', facebookUrl: config.facebookUrl || '', twitterUrl: config.twitterUrl || '', youtubeUrl: config.youtubeUrl || '', linkedinUrl: config.linkedinUrl || '', whatsappUrl: config.whatsappUrl || '' });
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

  const save = () => saveSection('cfg', () => updateConfigs(cfg));

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
        <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700 }}>Website & CMS</h2>
        <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>Manage landing page content, branding, and announcements</p>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Megaphone} title="Announcement Banner" sub="Pinned banner shown at the top of every page — dismissable by users" color="#F59E0B" />
        {announcements.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {announcements.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={S.badge(a.type)}>{a.type}</span>
                <span style={{ color: '#0F172A', fontSize: '13px', flex: 1 }}>{a.text}</span>
                <button onClick={clearAnnouncements} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
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
            <button key={t} onClick={() => setAnnType(t)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${annType === t ? '#4F46E5' : '#E5E7EB'}`, background: annType === t ? 'rgba(79,70,229,0.08)' : 'transparent', color: annType === t ? '#4F46E5' : '#475569', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: annType === t ? 600 : 400 }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={sendAnnouncement} disabled={busy.ann} style={S.saveBtn(busy.ann)}><Megaphone size={14} />{busy.ann ? 'Sending...' : 'Broadcast Announcement'}</button>
          {announcements.length > 0 && <button onClick={clearAnnouncements} disabled={busy.clearAnn} style={{ ...S.saveBtn(busy.clearAnn), background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', boxShadow: 'none' }}><X size={14} />Clear All</button>}
        </div>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Globe} title="Branding" sub="Site name, tagline, and logo used across the platform" color="#4F46E5" />
        <div className="admin-grid-2col">
          <div style={S.row}>
            <label style={S.label}>Site Name</label>
            <input value={branding.siteName} onChange={e => setBranding(b => ({ ...b, siteName: e.target.value }))} placeholder="MyStore OS" style={S.input} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Tagline</label>
            <input value={branding.siteTagline} onChange={e => setBranding(b => ({ ...b, siteTagline: e.target.value }))} placeholder="Run your shop, own your data." style={S.input} />
          </div>
        </div>
        <div className="admin-grid-2col">
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
        <SectionHeader icon={FileText} title="Landing Page Content" sub="Hero section text and call-to-action button" color="#10B981" />
        <div style={S.row}>
          <label style={S.label}>Hero Headline</label>
          <input value={landing.heroHeadline} onChange={e => setLanding(l => ({ ...l, heroHeadline: e.target.value }))} placeholder="Run Your Shop. Own Your Data." style={S.input} />
        </div>
        <div style={S.row}>
          <label style={S.label}>Hero Subheadline</label>
          <textarea value={landing.heroSubheadline} onChange={e => setLanding(l => ({ ...l, heroSubheadline: e.target.value }))} placeholder="The complete POS & ERP for Indian kirana shops." style={S.textarea} rows={2} />
        </div>
        <div className="admin-grid-2col">
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
        <SectionHeader icon={Globe} title="SEO & Social" sub="Meta tags and social profile links" color="#3B82F6" />
        <div style={S.row}>
          <label style={S.label}>Meta Description</label>
          <textarea value={seo.metaDescription} onChange={e => setSeo(s => ({ ...s, metaDescription: e.target.value }))} placeholder="MyStore OS — digital billing, inventory, GST, and more for Indian small businesses." style={S.textarea} rows={2} />
        </div>
        <div style={S.row}>
          <label style={S.label}>Meta Keywords (comma-separated)</label>
          <input value={seo.metaKeywords} onChange={e => setSeo(s => ({ ...s, metaKeywords: e.target.value }))} placeholder="kirana, billing, POS, inventory, GST, India" style={S.input} />
        </div>
        <div className="admin-grid-2col">
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
          <SectionHeader icon={CreditCard} title="Plan Names & Descriptions" sub="Edit plan display names and descriptions. Prices, discounts & cycles are managed in Settings → Subscription Pricing." color="#F43F5E" />
          <a href="/pricing" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4F46E5', fontSize: '12px', textDecoration: 'none', flexShrink: 0, marginTop: '2px', fontWeight: 600 }}>
            Preview <ExternalLink size={12} />
          </a>
        </div>
        {plans.map((plan, idx) => (
          <div key={plan.id} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '14px', marginBottom: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: '12px', color: '#4F46E5', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{plan.id}</div>
            <div style={S.row}>
              <label style={S.label}>Plan Name</label>
              <input value={plan.name} onChange={e => updatePlan(idx, 'name', e.target.value)} style={S.input} />
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

      {/* ── App Store & Social Links ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '20px' }}>📱</span>
          <div>
            <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '15px' }}>App Store & Social Links</div>
            <div style={{ color: '#64748B', fontSize: '12px' }}>These appear on the landing page. Leave blank to hide.</div>
          </div>
        </div>

        <div className="admin-grid-2col">
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
            <div key={field.key} style={S.row}>
              <label style={S.label}>
                {field.label}
              </label>
              <input
                type="url"
                value={cfg[field.key] || ''}
                onChange={e => setCfg(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                style={S.input}
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={S.saveBtn(saving)}
        >
          {saving ? 'Saving...' : '💾 Save App & Social Links'}
        </button>
      </div>
    </div>
  );
}
