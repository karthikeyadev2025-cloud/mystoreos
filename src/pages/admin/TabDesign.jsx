import { useState, useEffect } from 'react';
import { Save, Palette, RotateCcw, Code } from 'lucide-react';
import { useSiteConfig } from '../../lib/siteConfig';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const DEFAULTS = {
  primaryColor: '#f43f5e',
  accentColor: '#8b5cf6',
  bgColor: '#0f172a',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  textColor: '#f8fafc',
  mutedColor: '#94a3b8',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  borderRadius: '12px',
  fontFamily: 'Outfit',
  customCSS: '',
};

const PRESETS = [
  { name: 'Rose Dark (Default)', primaryColor: '#f43f5e', accentColor: '#8b5cf6', bgColor: '#0f172a' },
  { name: 'Ocean Blue', primaryColor: '#3b82f6', accentColor: '#06b6d4', bgColor: '#0a1628' },
  { name: 'Forest Green', primaryColor: '#10b981', accentColor: '#6ee7b7', bgColor: '#0a1f0a' },
  { name: 'Amber Warm', primaryColor: '#f59e0b', accentColor: '#fbbf24', bgColor: '#1a0f00' },
];

const S = {
  card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' },
  label: { color: '#475569', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  row: { marginBottom: '16px' },
  saveBtn: (busy) => ({ background: busy ? '#94a3b8' : '#4f46e5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
  sectionTitle: { color: '#0f172a', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748b', fontSize: '12px', marginBottom: '20px' },
};

function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <label style={{ ...S.label, width: '160px', marginBottom: 0, flexShrink: 0 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <input type="color" value={value.startsWith('#') ? value : '#000000'} onChange={e => onChange(e.target.value)}
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', padding: '2px' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', flex: 1 }} />
      </div>
    </div>
  );
}

export default function TabDesign() {
  const { config, updateConfigs } = useSiteConfig();
  const [theme, setTheme] = useState({ ...DEFAULTS });
  const [customCSS, setCustomCSS] = useState('');
  const [busy, setBusy] = useState({});

  useEffect(() => {
    const t = setTimeout(() => {
      setTheme({
        primaryColor: config.primaryColor || DEFAULTS.primaryColor,
        accentColor: config.accentColor || DEFAULTS.accentColor,
        bgColor: config.bgColor || DEFAULTS.bgColor,
        cardBg: config.cardBg || DEFAULTS.cardBg,
        cardBorder: config.cardBorder || DEFAULTS.cardBorder,
        textColor: config.textColor || DEFAULTS.textColor,
        mutedColor: config.mutedColor || DEFAULTS.mutedColor,
        successColor: config.successColor || DEFAULTS.successColor,
        warningColor: config.warningColor || DEFAULTS.warningColor,
        borderRadius: config.borderRadius || DEFAULTS.borderRadius,
        fontFamily: config.fontFamily || DEFAULTS.fontFamily,
      });
      setCustomCSS(config.customCSS || '');
    }, 0);
    return () => clearTimeout(t);
  }, [config]);

  const set = (k) => (v) => setTheme(t => ({ ...t, [k]: v }));

  const saveTheme = async () => {
    setBusy(b => ({ ...b, theme: true }));
    try {
      await updateConfigs({ ...theme });
      await api.logAdminAction('update_theme', 'design', null, null);
      toast.success('Theme saved and applied live');
    } catch { toast.error('Save failed'); }
    finally { setBusy(b => ({ ...b, theme: false })); }
  };

  const saveCSS = async () => {
    setBusy(b => ({ ...b, css: true }));
    try {
      await updateConfigs({ customCSS });
      await api.logAdminAction('update_custom_css', 'design', null, null);
      toast.success('Custom CSS applied');
    } catch { toast.error('Save failed'); }
    finally { setBusy(b => ({ ...b, css: false })); }
  };

  const resetTheme = async () => {
    setTheme({ ...DEFAULTS });
    await updateConfigs({ ...DEFAULTS });
    toast.success('Theme reset to defaults');
  };

  const applyPreset = (preset) => {
    setTheme(t => ({ ...t, primaryColor: preset.primaryColor, accentColor: preset.accentColor, bgColor: preset.bgColor }));
  };

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>Design & CSS</h2>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Customize platform colors, typography, and inject custom CSS</p>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Palette size={18} color="#4f46e5" /></div>
          <div><div style={S.sectionTitle}>Color Presets</div><div style={S.sectionSub}>Quick-apply a color scheme</div></div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {PRESETS.map(p => (
            <button key={p.name} onClick={() => applyPreset(p)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              <span style={{ display: 'flex', gap: '3px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.primaryColor }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.accentColor }} />
              </span>
              {p.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <div><div style={S.sectionTitle}>Color Variables</div><div style={S.sectionSub}>Changes apply live across the platform via CSS custom properties</div></div>
        </div>
        <ColorRow label="Primary Color" value={theme.primaryColor} onChange={set('primaryColor')} />
        <ColorRow label="Accent Color" value={theme.accentColor} onChange={set('accentColor')} />
        <ColorRow label="Background" value={theme.bgColor} onChange={set('bgColor')} />
        <ColorRow label="Text Color" value={theme.textColor} onChange={set('textColor')} />
        <ColorRow label="Muted Text" value={theme.mutedColor} onChange={set('mutedColor')} />
        <ColorRow label="Success Color" value={theme.successColor} onChange={set('successColor')} />
        <ColorRow label="Warning Color" value={theme.warningColor} onChange={set('warningColor')} />

        <div style={{ marginBottom: '16px', marginTop: '8px' }}>
          <label style={S.label}>Card Background (supports rgba)</label>
          <input value={theme.cardBg} onChange={e => setTheme(t => ({ ...t, cardBg: e.target.value }))}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Card Border (supports rgba)</label>
          <input value={theme.cardBorder} onChange={e => setTheme(t => ({ ...t, cardBorder: e.target.value }))}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={S.label}>Border Radius</label>
          <input value={theme.borderRadius} onChange={e => setTheme(t => ({ ...t, borderRadius: e.target.value }))}
            placeholder="12px" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', width: '200px' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={saveTheme} disabled={busy.theme} style={S.saveBtn(busy.theme)}><Save size={14} />{busy.theme ? 'Applying...' : 'Apply Theme'}</button>
          <button onClick={resetTheme} style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><RotateCcw size={14} />Reset Defaults</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Code size={18} color="#4f46e5" /></div>
          <div><div style={S.sectionTitle}>Custom CSS</div><div style={S.sectionSub}>Injected into {'<head>'} on every page — use for advanced overrides</div></div>
        </div>
        <textarea
          value={customCSS}
          onChange={e => setCustomCSS(e.target.value)}
          placeholder={`/* Custom CSS injected globally */\n.glass { backdrop-filter: blur(20px); }\n.card { border-radius: 16px; }`}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '14px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', width: '100%', minHeight: '200px', resize: 'vertical', lineHeight: 1.6 }}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button onClick={saveCSS} disabled={busy.css} style={S.saveBtn(busy.css)}><Code size={14} />{busy.css ? 'Injecting...' : 'Inject CSS'}</button>
          {customCSS && <button onClick={() => { setCustomCSS(''); updateConfigs({ customCSS: '' }); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px' }}>Clear CSS</button>}
        </div>
      </div>
    </div>
  );
}
