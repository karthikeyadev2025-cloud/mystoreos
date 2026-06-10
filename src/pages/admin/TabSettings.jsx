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
  const [pricing, setPricing] = useState(null);

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
        const yc = await api.getPricing();
        if (yc) setPricing(yc);
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

  const savePricing = () => saveSection('pricing', async () => {
    await api.savePricing(pricing);
    await api.logAdminAction('update_pricing', 'settings', null, pricing?.offer?.enabled ? 'offer_on' : 'offer_off');
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
        <SectionHeader icon={Save} title="Subscription Pricing & Launch Offer" sub="Monthly / quarterly / yearly prices, discounts and the first-N-users offer — the single source of truth shown everywhere" color="#f59e0b" />

        {!pricing ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>Loading pricing…</p>
        ) : (
          <>
            {/* Which billing cycles customers can choose */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
              {['monthly', 'quarterly', 'yearly'].map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pricing.enabledCycles?.[c] ?? false}
                    onChange={e => setPricing(p => ({ ...p, enabledCycles: { ...p.enabledCycles, [c]: e.target.checked } }))} />
                  <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{c}</span>
                </label>
              ))}
            </div>

            {/* Base prices per tier x cycle */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontSize: '12px', padding: '6px 8px' }}>Tier</th>
                    <th style={{ color: '#64748b', fontSize: '12px', padding: '6px 8px' }}>Monthly ₹</th>
                    <th style={{ color: '#64748b', fontSize: '12px', padding: '6px 8px' }}>Quarterly ₹</th>
                    <th style={{ color: '#64748b', fontSize: '12px', padding: '6px 8px' }}>Yearly ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {['starter', 'pro', 'enterprise'].map(tier => (
                    <tr key={tier}>
                      <td style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, padding: '6px 8px', textTransform: 'capitalize' }}>{tier}</td>
                      {['monthly', 'quarterly', 'yearly'].map(cycle => (
                        <td key={cycle} style={{ padding: '4px 6px' }}>
                          <input type="number" min="0" value={pricing.tiers?.[tier]?.[cycle] ?? ''}
                            onChange={e => setPricing(p => ({ ...p, tiers: { ...p.tiers, [tier]: { ...p.tiers[tier], [cycle]: Number(e.target.value) || 0 } } }))}
                            style={{ width: '100%', padding: '8px 9px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Promo discount per cycle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Quarterly discount %</label>
                <input type="number" min="0" max="100" value={pricing.discounts?.quarterly ?? 0}
                  onChange={e => setPricing(p => ({ ...p, discounts: { ...p.discounts, quarterly: Number(e.target.value) || 0 } }))}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Yearly discount %</label>
                <input type="number" min="0" max="100" value={pricing.discounts?.yearly ?? 0}
                  onChange={e => setPricing(p => ({ ...p, discounts: { ...p.discounts, yearly: Number(e.target.value) || 0 } }))}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Launch offer (first N users) */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                <input type="checkbox" checked={pricing.offer?.enabled ?? false}
                  onChange={e => setPricing(p => ({ ...p, offer: { ...p.offer, enabled: e.target.checked } }))} />
                <span style={{ color: '#92400E', fontSize: '13px', fontWeight: 700 }}>Enable launch offer (extra discount for first N users)</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Extra discount %</label>
                  <input type="number" min="0" max="100" value={pricing.offer?.percent ?? 0}
                    onChange={e => setPricing(p => ({ ...p, offer: { ...p.offer, percent: Number(e.target.value) || 0 } }))}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Cap (first N)</label>
                  <input type="number" min="0" value={pricing.offer?.cap ?? 0}
                    onChange={e => setPricing(p => ({ ...p, offer: { ...p.offer, cap: Number(e.target.value) || 0 } }))}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Slots remaining</label>
                  <input type="number" min="0" value={pricing.offer?.remaining ?? 0}
                    onChange={e => setPricing(p => ({ ...p, offer: { ...p.offer, remaining: Number(e.target.value) || 0 } }))}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <p style={{ color: '#a16207', fontSize: '11px', margin: '10px 0 0', lineHeight: 1.5 }}>
                Slots remaining auto-decrements on each successful quarterly/yearly payment; you can also adjust it here. When it hits 0 the extra offer stops automatically (cycle discounts still apply).
              </p>
            </div>

            <button onClick={savePricing} disabled={busy.pricing} style={S.saveBtn(busy.pricing)}><Save size={14} />{busy.pricing ? 'Saving...' : 'Save Pricing'}</button>
          </>
        )}
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
