import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, AlertTriangle, Shield, Key, Globe, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' },
  label: { color: '#475569', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  input: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%' },
  row: { marginBottom: '18px' },
  sectionTitle: { color: '#0f172a', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748b', fontSize: '12px', marginBottom: '18px' },
  saveBtn: (busy) => ({ background: busy ? '#94a3b8' : '#4f46e5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
  toggle: (on) => ({ width: '40px', height: '22px', borderRadius: '11px', background: on ? '#4f46e5' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }),
  toggleKnob: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }),
};

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={S.toggle(on)} type="button" aria-pressed={on}>
      <span style={S.toggleKnob(on)} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, sub, color = '#4f46e5' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
      <div style={{ background: `${color}15`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
      <div><div style={S.sectionTitle}>{title}</div><div style={S.sectionSub}>{sub}</div></div>
    </div>
  );
}

export default function TabSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const [razorpayKey, setRazorpayKey] = useState('');
  const [showKey, setShowKey] = useState(true);

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');

  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [googleLoginEnabled, setGoogleLoginEnabled] = useState(false);
  const [yearly, setYearly] = useState({ enabled: false, offerPercent: 50, offerCap: 1000, offerRemaining: 1000, prices: { starter: '', pro: '', enterprise: '' } });

  const [supportEmail, setSupportEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappSupport, setWhatsappSupport] = useState('');

  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [settings, theme] = await Promise.all([
          api.getSettings(),
          api.getSiteTheme(),
        ]);
        setRazorpayKey(settings.razorpayKey || '');
        setMaintenance(theme.maintenanceMode === true || theme.maintenanceMode === 'true');
        setMaintenanceMsg(theme.maintenanceMessage || '');
        setRegistrationOpen(theme.registrationOpen !== false);
        setGoogleLoginEnabled(theme.googleLoginEnabled === true || theme.googleLoginEnabled === 'true');
        const yc = await api.getYearlyConfig();
        if (yc) setYearly({ enabled: !!yc.enabled, offerPercent: yc.offerPercent ?? 50, offerCap: yc.offerCap ?? 1000, offerRemaining: yc.offerRemaining ?? 1000, prices: { starter: yc.prices?.starter ?? '', pro: yc.prices?.pro ?? '', enterprise: yc.prices?.enterprise ?? '' } });
        setSupportEmail(theme.supportEmail || '');
        setContactPhone(theme.contactPhone || '');
        setWhatsappSupport(theme.whatsappSupport || '');
      } catch { toast.error('Failed to load settings'); }
      finally { setLoading(false); }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const saveSection = async (key, fn) => {
    setBusy(b => ({ ...b, [key]: true }));
    try { await fn(); toast.success('Saved'); }
    catch { toast.error('Save failed'); }
    finally { setBusy(b => ({ ...b, [key]: false })); }
  };

  const savePayment = () => saveSection('payment', async () => {
    await api.saveSettings({ razorpayKey });
    await api.logAdminAction('update_razorpay_key', 'settings', null, 'updated');
  });

  const saveMaintenance = () => saveSection('maintenance', async () => {
    const current = await api.getSiteTheme();
    await api.saveSiteTheme({ ...current, maintenanceMode: maintenance, maintenanceMessage: maintenanceMsg, registrationOpen });
    await api.setMaintenanceMode(maintenance);
    await api.logAdminAction('maintenance_mode', 'settings', null, maintenance ? 'enabled' : 'disabled');
  });

  const saveContact = () => saveSection('contact', async () => {
    const current = await api.getSiteTheme();
    await api.saveSiteTheme({ ...current, supportEmail, contactPhone, whatsappSupport });
    await api.logAdminAction('update_contact_settings', 'settings', null, 'updated');
  });

  const saveAuth = () => saveSection('auth', async () => {
    const current = await api.getSiteTheme();
    await api.saveSiteTheme({ ...current, googleLoginEnabled });
    await api.logAdminAction('update_auth_settings', 'settings', null, googleLoginEnabled ? 'google_on' : 'google_off');
  });

  const saveYearly = () => saveSection('yearly', async () => {
    await api.saveYearlyConfig({
      enabled: !!yearly.enabled,
      offerPercent: Math.max(0, Math.min(100, Number(yearly.offerPercent) || 0)),
      offerCap: Math.max(0, Number(yearly.offerCap) || 0),
      offerRemaining: Math.max(0, Number(yearly.offerRemaining) || 0),
      prices: {
        starter: Number(yearly.prices.starter) || 0,
        pro: Number(yearly.prices.pro) || 0,
        enterprise: Number(yearly.prices.enterprise) || 0,
      },
    });
    await api.logAdminAction('update_yearly_plans', 'settings', null, yearly.enabled ? 'enabled' : 'disabled');
  });

  const changeAdminPassword = async (e) => {
    e.preventDefault();
    if (adminPass.length < 8) return toast.error('Password must be at least 8 characters');
    if (adminPass !== adminPassConfirm) return toast.error('Passwords do not match');
    setBusy(b => ({ ...b, adminPass: true }));
    try {
      await api.adminResetPassword('admin', adminPass);
      await api.logAdminAction('admin_password_change', 'admin', null, null);
      toast.success('Admin password updated');
      setAdminPass('');
      setAdminPassConfirm('');
    } catch { toast.error('Password change failed'); }
    finally { setBusy(b => ({ ...b, adminPass: false })); }
  };

  if (loading) return <div style={{ textAlign: 'center', color: '#64748b', padding: '60px' }}>Loading settings...</div>;

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>System Settings</h2>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Platform configuration and security settings</p>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Key} title="Payment Gateway" sub="Razorpay public key shown to customers during checkout" color="#f59e0b" />
        <div style={S.row}>
          <label style={S.label}>Razorpay Public Key (VITE_RAZORPAY_KEY)</label>
          <div style={{ position: 'relative' }}>
            <input value={razorpayKey} onChange={e => setRazorpayKey(e.target.value)} type={showKey ? 'text' : 'password'} placeholder="rzp_live_..." autoComplete="off" spellCheck="false" style={{ ...S.input, paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>The secret key lives in your server .env — never expose it here.</p>
        </div>
        <button onClick={savePayment} disabled={busy.payment} style={S.saveBtn(busy.payment)}><Save size={14} />{busy.payment ? 'Saving...' : 'Save Payment Settings'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={AlertTriangle} title="Maintenance & Access" sub="Take the site offline for non-admin users during upgrades" color="#ef4444" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div>
            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>Maintenance Mode</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>All users except admins will see a maintenance screen</div>
          </div>
          <Toggle on={maintenance} onChange={setMaintenance} />
        </div>
        {maintenance && (
          <div style={S.row}>
            <label style={S.label}>Maintenance Message</label>
            <input value={maintenanceMsg} onChange={e => setMaintenanceMsg(e.target.value)} placeholder="We are performing scheduled maintenance. Back soon!" style={S.input} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>Registration Open</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Allow new users to register on the platform</div>
          </div>
          <Toggle on={registrationOpen} onChange={setRegistrationOpen} />
        </div>
        <button onClick={saveMaintenance} disabled={busy.maintenance} style={S.saveBtn(busy.maintenance)}><Save size={14} />{busy.maintenance ? 'Saving...' : 'Save Maintenance Settings'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Globe} title="Contact & Support" sub="Contact details shown to users across the platform" color="#3b82f6" />
        <div style={S.row}>
          <label style={S.label}>Support Email</label>
          <input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="support@mystore.app" type="email" style={S.input} />
        </div>
        <div style={S.row}>
          <label style={S.label}>Contact Phone</label>
          <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 98765 43210" style={S.input} />
        </div>
        <div style={S.row}>
          <label style={S.label}>WhatsApp Support Number</label>
          <input value={whatsappSupport} onChange={e => setWhatsappSupport(e.target.value)} placeholder="9876543210 (no country code)" style={S.input} />
        </div>
        <button onClick={saveContact} disabled={busy.contact} style={S.saveBtn(busy.contact)}><Save size={14} />{busy.contact ? 'Saving...' : 'Save Contact Info'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Key} title="Authentication & Sign-in" sub="Google login and the URLs to configure it" color="#10b981" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>Enable "Continue with Google"</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Show the Google sign-in button on the login screen</div>
          </div>
          <Toggle on={googleLoginEnabled} onChange={setGoogleLoginEnabled} />
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', margin: '16px 0' }}>
          <div style={{ color: '#475569', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>
            Setup reference — paste these into Supabase &amp; Google Cloud:
          </div>
          {[
            { label: 'Supabase → Auth → Redirect URLs', val: `${window.location.origin}/auth/callback` },
            { label: 'Supabase → Auth → Redirect URLs', val: `${window.location.origin}/auth/reset` },
            { label: 'Google Cloud → Authorized redirect URI', val: 'https://zdertmpzervgjicuwsfz.supabase.co/auth/v1/callback' },
            { label: 'Google Cloud → Authorized JS origin', val: window.location.origin },
          ].map(({ label, val }, i) => (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '3px' }}>{label}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <code style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', color: '#0f172a', overflowX: 'auto', whiteSpace: 'nowrap' }}>{val}</code>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(val); toast.success('Copied'); }}
                  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 10px', cursor: 'pointer', fontSize: '12px', color: '#475569', flexShrink: 0 }}>Copy</button>
              </div>
            </div>
          ))}
          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '6px', lineHeight: 1.5 }}>
            The Google Client ID &amp; Secret are stored in Supabase (Auth → Providers → Google), never in the app.
            Password-reset emails are sent via the SMTP provider configured in Supabase.
          </div>
        </div>

        <button onClick={saveAuth} disabled={busy.auth} style={S.saveBtn(busy.auth)}><Save size={14} />{busy.auth ? 'Saving...' : 'Save Auth Settings'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Save} title="Yearly Plans & Launch Offer" sub="Annual pricing + a limited first-N-users discount" color="#f59e0b" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>Enable yearly plans</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Show a Monthly/Yearly toggle on the plan selector</div>
          </div>
          <Toggle on={yearly.enabled} onChange={(v) => setYearly(y => ({ ...y, enabled: v }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', margin: '16px 0' }}>
          {['starter', 'pro', 'enterprise'].map(tier => (
            <div key={tier}>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px', textTransform: 'capitalize' }}>{tier} yearly ₹</label>
              <input type="number" min="0" value={yearly.prices[tier]}
                onChange={e => setYearly(y => ({ ...y, prices: { ...y.prices, [tier]: e.target.value } }))}
                placeholder="e.g. 5999"
                style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Offer discount %</label>
            <input type="number" min="0" max="100" value={yearly.offerPercent}
              onChange={e => setYearly(y => ({ ...y, offerPercent: e.target.value }))}
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Offer cap (first N)</label>
            <input type="number" min="0" value={yearly.offerCap}
              onChange={e => setYearly(y => ({ ...y, offerCap: e.target.value }))}
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Slots remaining</label>
            <input type="number" min="0" value={yearly.offerRemaining}
              onChange={e => setYearly(y => ({ ...y, offerRemaining: e.target.value }))}
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 14px', lineHeight: 1.5 }}>
          The offer applies the discount to yearly prices while slots remain. "Slots remaining" auto-decrements on each successful yearly payment; you can also adjust it here manually.
        </p>

        <button onClick={saveYearly} disabled={busy.yearly} style={S.saveBtn(busy.yearly)}><Save size={14} />{busy.yearly ? 'Saving...' : 'Save Yearly Plans'}</button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Shield} title="Admin Security" sub="Change the super-admin account password" color="#4f46e5" />
        <form onSubmit={changeAdminPassword}>
          <div style={S.row}>
            <label style={S.label}>New Admin Password</label>
            <input value={adminPass} onChange={e => setAdminPass(e.target.value)} type="password" placeholder="Min 8 characters" style={S.input} required minLength={8} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Confirm Password</label>
            <input value={adminPassConfirm} onChange={e => setAdminPassConfirm(e.target.value)} type="password" placeholder="Repeat new password" style={S.input} required />
          </div>
          <div style={{ background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.15)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Users size={14} color="#4f46e5" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ color: '#4f46e5', fontSize: '12px' }}>This changes the super admin password only. Staff and shop passwords are managed in their respective management tabs.</span>
          </div>
          <button type="submit" disabled={busy.adminPass} style={S.saveBtn(busy.adminPass)}><Shield size={14} />{busy.adminPass ? 'Updating...' : 'Update Admin Password'}</button>
        </form>
      </div>
    </div>
  );
}
