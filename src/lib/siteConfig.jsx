import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import { api } from './api';

const DEFAULTS = {
  // Branding
  siteName: 'MyStore OS',
  siteTagline: 'Manage your shop, grow your business.',
  siteLogo: '',
  faviconUrl: '',
  // Colors
  primaryColor: '#4F46E5',
  accentColor: '#818CF8',
  bgColor: '#0f172a',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  textColor: '#f8fafc',
  mutedColor: '#94a3b8',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  // Typography
  fontFamily: 'Outfit',
  borderRadius: '12px',
  // Feature flags
  maintenanceMode: false,
  maintenanceMessage: 'We are performing scheduled maintenance. Back soon!',
  registrationOpen: true,
  googleLoginEnabled: false,
  // Announcement banner
  announcementText: '',
  announcementType: 'info',
  announcementActive: false,
  // Landing page
  heroHeadline: 'Run Your Shop. Own Your Data.',
  heroSubheadline: 'The complete POS & ERP for Indian kirana shops.',
  heroCtaText: 'Start Free Trial',
  heroCtaUrl: '/register',
  // SEO
  metaDescription: 'MyStore OS — digital billing, inventory, GST, and more for Indian small businesses.',
  metaKeywords: 'kirana, billing, POS, inventory, GST, India',
  // Social
  whatsappSupport: '',
  instagramUrl: '',
  twitterUrl: '',
  // Custom code
  customCSS: '',
  customHeaderScript: '',
  // Admin
  supportEmail: 'support@mystore.app',
  contactPhone: '',
  razorpayKeyPublic: '',
};

const SiteConfigContext = createContext({ config: DEFAULTS, updateConfig: () => {}, updateConfigs: () => {} });

function applyToDOM(cfg) {
  const root = document.documentElement;
  root.style.setProperty('--primary', cfg.primaryColor || DEFAULTS.primaryColor);
  root.style.setProperty('--secondary', cfg.accentColor || DEFAULTS.accentColor);
  root.style.setProperty('--bg-dark', cfg.bgColor || DEFAULTS.bgColor);
  root.style.setProperty('--text', cfg.textColor || DEFAULTS.textColor);
  root.style.setProperty('--text-muted', cfg.mutedColor || DEFAULTS.mutedColor);
  root.style.setProperty('--success', cfg.successColor || DEFAULTS.successColor);
  root.style.setProperty('--warning', cfg.warningColor || DEFAULTS.warningColor);
  root.style.setProperty('--card-bg', cfg.cardBg || DEFAULTS.cardBg);
  root.style.setProperty('--card-border', cfg.cardBorder || DEFAULTS.cardBorder);
  root.style.setProperty('--radius', cfg.borderRadius || DEFAULTS.borderRadius);
  if (cfg.fontFamily) root.style.setProperty('--font', cfg.fontFamily);
  const styleId = 'site-custom-css';
  let el = document.getElementById(styleId);
  if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el); }
  el.textContent = cfg.customCSS || '';
}

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);
  const configRef = useRef(DEFAULTS);
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    api.getSiteConfig('site_theme', null).then(stored => {
      if (stored && typeof stored === 'object') {
        const merged = { ...DEFAULTS, ...stored };
        setConfig(merged);
        applyToDOM(merged);
      } else {
        applyToDOM(DEFAULTS);
      }
    }).catch(() => applyToDOM(DEFAULTS));

    let channel = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('site-config-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config', filter: 'key=eq.site_theme' }, (payload) => {
          const val = payload.new?.value;
          if (val && typeof val === 'object') {
            const merged = { ...DEFAULTS, ...val };
            setConfig(merged);
            applyToDOM(merged);
          }
        })
        .subscribe();
    }

    const handler = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        setConfig(prev => {
          const merged = { ...prev, ...e.detail };
          applyToDOM(merged);
          return merged;
        });
      }
    };
    window.addEventListener('site-config-updated', handler);
    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('site-config-updated', handler);
    };
  }, []);

  const updateConfig = useCallback(async (key, value) => {
    const next = { ...configRef.current, [key]: value };
    applyToDOM(next);
    setConfig(next);
    window.dispatchEvent(new CustomEvent('site-config-updated', { detail: { [key]: value } }));
    await api.saveSiteConfig('site_theme', next);
  }, []);

  const updateConfigs = useCallback(async (obj) => {
    const next = { ...configRef.current, ...obj };
    applyToDOM(next);
    setConfig(next);
    window.dispatchEvent(new CustomEvent('site-config-updated', { detail: obj }));
    // Await the actual DB write so callers know if it failed (no silent catch).
    await api.saveSiteConfig('site_theme', next);
  }, []);

  return (
    <SiteConfigContext value={{ config, updateConfig, updateConfigs }}>
      {children}
    </SiteConfigContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSiteConfig = () => useContext(SiteConfigContext);
