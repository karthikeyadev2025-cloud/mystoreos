import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, AlertTriangle, Shield, Key, Globe, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', marginBottom: '20px' },
  label: { color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%' },
  row: { marginBottom: '18px' },
  sectionTitle: { color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748b', fontSize: '12px', marginBottom: '18px' },
  saveBtn: (busy) => ({ background: busy ? '#64748b' : '#f43f5e', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
  toggle: (on) => ({ width: '40px', height: '22px', borderRadius: '11px', background: on ? '#f43f5e' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }),
  toggleKnob: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }),
};

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={S.toggle(on)} type="button" aria-pressed={on}>
      <span style={S.toggleKnob(on)} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, sub, color = '#f43f5e' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
      <div style={{ background: `${color}22`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
      <div><div style={S.sectionTitle}>{title}</div><div style={S.sectionSub}>{sub}</div></div>
    </div>
  );
}

export default function TabSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const [razorpayKey, setRazorpayKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');

  const [registrationOpen, setRegistrationOpen] = useState(true);

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

  if (loading) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>Loading settings...</div>;

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>System Settings</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Platform configuration and security settings</p>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Key} title="Payment Gateway" sub="Razorpay public key shown to customers during checkout" color="#f59e0b" />
        <div style={S.row}>
          <label style={S.label}>Razorpay Public Key (VITE_RAZORPAY_KEY)</label>
          <div style={{ position: 'relative' }}>
            <input value={razorpayKey} onChange={e => setRazorpayKey(e.target.value)} type={showKey ? 'text' : 'password'} placeholder="rzp_live_..." style={{ ...S.input, paddingRight: '40px' }} />
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
            <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}>Maintenance Mode</div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>All users except admins will see a maintenance screen</div>
          </div>
          <Toggle on={maintenance} onChange={setMaintenance} />
        </div>
        {maintenance && (
          <div style={S.row}>
            <label style={S.label}>Maintenance Message</label>
            <input value={maintenanceMsg} onChange={e => setMaintenanceMsg(e.target.value)} placeholder="We are performing scheduled maintenance. Back soon!" style={S.input} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          <div>
            <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}>Registration Open</div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>Allow new users to register on the platform</div>
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
        <SectionHeader icon={Shield} title="Admin Security" sub="Change the super-admin account password" color="#8b5cf6" />
        <form onSubmit={changeAdminPassword}>
          <div style={S.row}>
            <label style={S.label}>New Admin Password</label>
            <input value={adminPass} onChange={e => setAdminPass(e.target.value)} type="password" placeholder="Min 8 characters" style={S.input} required minLength={8} />
          </div>
          <div style={S.row}>
            <label style={S.label}>Confirm Password</label>
            <input value={adminPassConfirm} onChange={e => setAdminPassConfirm(e.target.value)} type="password" placeholder="Repeat new password" style={S.input} required />
          </div>
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Users size={14} color="#8b5cf6" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ color: '#a78bfa', fontSize: '12px' }}>This changes the super admin password only. Staff and shop passwords are managed in their respective management tabs.</span>
          </div>
          <button type="submit" disabled={busy.adminPass} style={S.saveBtn(busy.adminPass)}><Shield size={14} />{busy.adminPass ? 'Updating...' : 'Update Admin Password'}</button>
        </form>
      </div>
    </div>
  );
}
