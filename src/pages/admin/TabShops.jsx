import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, CheckCircle, XCircle, Trash2, Key, ShieldCheck, RefreshCw,
  AlertTriangle, Eye, EyeOff, Store, Image, X,
  Clock, ChevronDown, Star
} from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAN_CFG = {
  trial:      { color: '#64748b', bg: '#F1F5F9', label: 'Trial',      icon: '⏱' },
  starter:    { color: '#f59e0b', bg: '#FEF3C7', label: 'Starter',    icon: '🌱' },
  pro:        { color: '#4F46E5', bg: '#EEF2FF', label: 'Pro',        icon: '⚡' },
  enterprise: { color: '#10b981', bg: '#ECFDF5', label: 'Enterprise', icon: '🏆' },
  // Was missing entirely — every Service-tier shop (service_starter/
  // _pro/_enterprise, added when Service pricing was split from Retail)
  // fell through to PLAN_CFG[tier] || PLAN_CFG.trial, meaning a paying
  // Service Pro customer's badge in the admin's own shop list showed
  // "⏱ Trial" — visually indistinguishable from someone who hadn't
  // paid at all.
  service_starter:    { color: '#fb923c', bg: '#FFF7ED', label: 'Svc Starter',    icon: '🌱' },
  service_pro:        { color: '#a78bfa', bg: '#F5F3FF', label: 'Svc Pro',        icon: '⚡' },
  service_enterprise: { color: '#34d399', bg: '#ECFDF5', label: 'Svc Enterprise', icon: '🏆' },
};
const STATUS_CFG = {
  active:    { color: '#10B981', bg: '#ECFDF5', dot: '#10B981', label: 'Active' },
  pending:   { color: '#F59E0B', bg: '#FEF3C7', dot: '#F59E0B', label: 'Pending' },
  suspended: { color: '#EF4444', bg: '#FEF2F2', dot: '#EF4444', label: 'Suspended' },
};
const FILTERS = [
  { key: 'all',        label: 'All Shops' },
  { key: 'pending',    label: '⏳ Pending' },
  { key: 'active',     label: '✅ Active' },
  { key: 'trial',      label: '⏱ Trial' },
  { key: 'starter',    label: '🌱 Starter' },
  { key: 'pro',        label: '⚡ Pro' },
  { key: 'enterprise', label: '🏆 Enterprise' },
  { key: 'service_starter',    label: '🌱 Svc Starter' },
  { key: 'service_pro',        label: '⚡ Svc Pro' },
  { key: 'service_enterprise', label: '🏆 Svc Enterprise' },
];

const font = { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' };
const btn = (c = '#4F46E5') => ({ ...font, height: 32, background: `${c}12`, border: `1px solid ${c}30`, color: c, borderRadius: 8, padding: '0 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });
const inp = { ...font, background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 8, color: '#0F172A', padding: '8px 12px', fontSize: 13, outline: 'none' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function PlanBadge({ tier }) {
  const c = PLAN_CFG[tier] || PLAN_CFG.trial;
  return <span style={{ background: c.bg, color: c.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.icon} {c.label}</span>;
}
function StatusDot({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />{c.label}
    </span>
  );
}
function Avatar({ shop, size = 36 }) {
  return shop.logo
    ? <img src={shop.logo} alt="" style={{ width: size, height: size, borderRadius: size / 3, objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: size / 3, background: `hsl(${(shop.name||'S').charCodeAt(0) * 7 % 360},60%,50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{(shop.name||'S')[0].toUpperCase()}</div>;
}

// ── Reset Password Modal ───────────────────────────────────────────────────────
function ResetPassModal({ shop, onClose, onDone }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (pass.length < 6) return toast.error('Min 6 characters');
    setBusy(true);
    try { await api.adminResetPassword(shop.id, pass); await api.logAdminAction('reset_password', shop.id, null, null); toast.success('Password reset'); onDone(); }
    catch { toast.error('Reset failed'); }
    finally { setBusy(false); }
  };
  return (
    <Overlay onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 340, ...font }}>
        <h3 style={{ margin: '0 0 6px', fontWeight: 800, color: '#0F172A' }}>Reset Password</h3>
        <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 16px' }}>New password for <b>{shop.name}</b></p>
        <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Min 6 characters" type="password" style={{ ...inp, width: '100%', marginBottom: 16, boxSizing: 'border-box' }} required />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: 8, padding: 10, cursor: 'pointer', fontWeight: 700, ...font }}>{busy ? 'Saving…' : 'Reset'}</button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 8, padding: 10, cursor: 'pointer', ...font }}>Cancel</button>
        </div>
      </form>
    </Overlay>
  );
}

// ── Plan Upgrade Modal ─────────────────────────────────────────────────────────
function UpgradeModal({ shop, onClose, onDone }) {
  const [tier, setTier] = useState(shop.subscriptionTier || 'starter');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.updateUserSubscription(shop.id, tier, null); await api.logAdminAction('upgrade_plan', shop.id, shop.subscriptionTier, tier); toast.success(`${shop.name} → ${PLAN_CFG[tier]?.label}`); onDone(); }
    catch { toast.error('Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Overlay onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 360, ...font }}>
        <h3 style={{ margin: '0 0 6px', fontWeight: 800, color: '#0F172A' }}>Change Plan</h3>
        <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 18px' }}>{shop.name}</p>
        {Object.entries(PLAN_CFG).map(([key, cfg]) => (
          <button key={key} onClick={() => setTier(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: `2px solid ${tier === key ? cfg.color : '#E5E7EB'}`, background: tier === key ? cfg.bg : 'transparent', cursor: 'pointer', marginBottom: 8, ...font, textAlign: 'left' }}>
            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: tier === key ? cfg.color : '#0F172A' }}>{cfg.label}</div>
            </div>
            {tier === key && <CheckCircle size={16} color={cfg.color} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: 8, padding: 11, cursor: 'pointer', fontWeight: 700, ...font }}>{busy ? 'Saving…' : 'Apply'}</button>
          <button onClick={onClose} style={{ flex: 1, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 8, padding: 11, cursor: 'pointer', ...font }}>Cancel</button>
        </div>
      </div>
    </Overlay>
  );
}

// ── Overlay wrapper ────────────────────────────────────────────────────────────
function Overlay({ children, onClick }) {
  return <div onClick={onClick} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>{children}</div>;
}

// ── Shop Detail / Verify Modal ─────────────────────────────────────────────────
function ShopDetailModal({ shop, onClose, onApprove, onSuspend, onActivate, onUpgrade }) {
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [tab, setTab]           = useState('overview');
  const photos = shop.shopPhotos || [];
  const tier   = shop.subscriptionTier || shop.subscription || 'trial';
  const planCfg = PLAN_CFG[tier] || PLAN_CFG.trial;

  const act = async (fn, label) => {
    setBusy(true);
    try { await fn(); toast.success(label); onClose(); }
    catch (e) { toast.error(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Overlay onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', ...font }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 16, alignItems: 'center', background: shop.status === 'pending' ? 'linear-gradient(135deg,#FEF9C3,#FEF3C7)' : 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', flexShrink: 0 }}>
          <Avatar shop={shop} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <PlanBadge tier={tier} />
              <StatusDot status={shop.status} />
              {photos.length > 0 && <span style={{ fontSize: 11, color: '#64748B' }}>📸 {photos.length} photo{photos.length !== 1 ? 's' : ''}</span>}
              {shop.gstin && <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>✓ GST</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0, background: '#FAFAFA' }}>
          {[['overview', 'Overview'], ['photos', `Photos (${photos.length})`], ['actions', 'Actions']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '12px 16px', border: 'none', background: 'none', borderBottom: tab === k ? '2px solid #4F46E5' : '2px solid transparent', color: tab === k ? '#4F46E5' : '#64748B', fontWeight: tab === k ? 700 : 500, fontSize: 13, cursor: 'pointer', ...font }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {tab === 'overview' && (
            <div>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { icon: '📱', label: 'Phone', value: shop.phone },
                  { icon: '📍', label: 'Address', value: shop.businessAddress || '—' },
                  { icon: '🏪', label: 'Category', value: shop.shopCategory || '—' },
                  { icon: '🧾', label: 'GSTIN', value: shop.gstin || 'Not provided' },
                  { icon: '💳', label: 'UPI ID', value: shop.upiId || '—' },
                  { icon: '📅', label: 'Joined', value: shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                  { icon: '🗺️', label: 'Coordinates', value: shop.latitude ? `${Number(shop.latitude).toFixed(5)}, ${Number(shop.longitude).toFixed(5)}` : '—' },
                  { icon: '👁️', label: 'Visibility', value: shop.hideFromSearch ? 'Hidden from search' : 'Visible in search' },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{icon} {label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Plan info */}
              <div style={{ background: planCfg.bg, border: `1px solid ${planCfg.color}30`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28 }}>{planCfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: planCfg.color }}>{planCfg.label} Plan</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {shop.planExpiresAt ? `Expires ${new Date(shop.planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : shop.trialStartedAt ? `Trial started ${new Date(shop.trialStartedAt).toLocaleDateString('en-IN')}` : 'No expiry set'}
                  </div>
                </div>
                <button onClick={onUpgrade} style={{ ...btn(planCfg.color), height: 34 }}><ChevronDown size={13} /> Change Plan</button>
              </div>
            </div>
          )}

          {tab === 'photos' && (
            <div>
              {photos.length === 0 ? (
                <div style={{ background: '#F8FAFC', border: '2px dashed #CBD5E1', borderRadius: 14, padding: 40, textAlign: 'center' }}>
                  <Image size={32} color="#CBD5E1" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>No shop photos uploaded</div>
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>Consider requesting photos before approving this shop.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginBottom: 12 }}>
                    {photos.map((src, i) => (
                      <div key={i} onClick={() => setLightbox(i)} style={{ cursor: 'zoom-in', position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', aspectRatio: '4/3' }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.6))', padding: '16px 8px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: i === 0 ? '#4F46E5' : 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 6 }}>{i === 0 ? 'COVER' : `#${i + 1}`}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>🔍 View</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', margin: 0 }}>Click any photo to enlarge</p>
                </>
              )}
            </div>
          )}

          {tab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shop.status === 'pending' && (
                <ActionRow
                  icon={<CheckCircle size={18} color="#10B981" />}
                  title="Approve Shop"
                  desc="Verify photos and details, then activate this shop on the platform"
                  action="Approve" color="#10B981"
                  onClick={() => act(() => onApprove(shop), `${shop.name} approved ✅`)}
                  busy={busy}
                />
              )}
              {shop.status === 'active' && (
                <ActionRow
                  icon={<XCircle size={18} color="#F59E0B" />}
                  title="Suspend Shop"
                  desc="Temporarily disable this shop's access to the platform"
                  action="Suspend" color="#F59E0B"
                  onClick={() => act(() => onSuspend(shop), `${shop.name} suspended`)}
                  busy={busy}
                />
              )}
              {shop.status === 'suspended' && (
                <ActionRow
                  icon={<ShieldCheck size={18} color="#10B981" />}
                  title="Reactivate Shop"
                  desc="Restore full access to this shop"
                  action="Activate" color="#10B981"
                  onClick={() => act(() => onActivate(shop), `${shop.name} activated ✅`)}
                  busy={busy}
                />
              )}
              <ActionRow
                icon={<Key size={18} color="#4F46E5" />}
                title="Reset Password"
                desc="Set a new password for the shop owner's account"
                action="Reset" color="#4F46E5"
                onClick={onUpgrade} // will be overridden
                busy={false}
                customAction={<button onClick={() => { onClose(); setTimeout(() => onUpgrade('reset'), 100); }} style={{ ...btn('#4F46E5'), height: 34 }}>Reset PW</button>}
              />
              <ActionRow
                icon={shop.hideFromSearch ? <Eye size={18} color="#0EA5E9" /> : <EyeOff size={18} color="#64748B" />}
                title={shop.hideFromSearch ? 'Show in Search' : 'Hide from Search'}
                desc={shop.hideFromSearch ? 'Make this shop visible in the marketplace' : 'Hide this shop from public search results'}
                action={shop.hideFromSearch ? 'Show' : 'Hide'} color={shop.hideFromSearch ? '#0EA5E9' : '#64748B'}
                onClick={() => act(() => api.setShopVisibility(shop.id, !shop.hideFromSearch), `Visibility updated`)}
                busy={busy}
              />
              <ActionRow
                icon={<Trash2 size={18} color="#EF4444" />}
                title="Delete Shop"
                desc="Permanently remove this shop and all its data — this cannot be undone"
                action="Delete" color="#EF4444"
                onClick={() => {
                  // Was deleting WITHOUT logAdminAction, while the other
                  // delete path in this same file logs correctly. A shop
                  // removed through this button left no audit trail at
                  // all — for a permanent, irreversible action on someone
                  // else's business data, that's the one operation that
                  // most needs a record of who did it and when.
                  if (window.confirm(`Permanently delete ${shop.name}? This cannot be undone.`)) {
                    act(async () => {
                      await api.deleteUser(shop.id);
                      await api.logAdminAction('delete_shop', shop.id, null, null);
                    }, `${shop.name} deleted`);
                  }
                }}
                busy={busy}
                danger
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 1300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={photos[lightbox]} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div style={{ display: 'flex', gap: 14, marginTop: 18, alignItems: 'center' }}>
            {lightbox > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(l => l - 1); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 42, height: 42, borderRadius: '50%', fontSize: 22, cursor: 'pointer' }}>‹</button>}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{lightbox + 1} / {photos.length}</span>
            {lightbox < photos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(l => l + 1); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 42, height: 42, borderRadius: '50%', fontSize: 22, cursor: 'pointer' }}>›</button>}
          </div>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </Overlay>
  );
}

function ActionRow({ icon, title, desc, action, color, onClick, busy, danger, customAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: danger ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${danger ? '#FECACA' : '#E2E8F0'}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: danger ? '#FEE2E2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{desc}</div>
      </div>
      {customAction || (
        <button disabled={busy} onClick={onClick} style={{ ...btn(color), height: 34, flexShrink: 0, background: danger ? '#EF4444' : `${color}12`, color: danger ? '#fff' : color, border: danger ? 'none' : `1px solid ${color}30` }}>
          {busy ? '…' : action}
        </button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TabShops() {
  const [shops,       setShops]       = useState([]);
  const [pending,     setPending]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [sortBy,      setSortBy]      = useState('joined_desc');
  const [viewMode,    setViewMode]    = useState('table'); // 'table' | 'grid'
  const [busy,        setBusy]        = useState({});
  const [detailModal, setDetailModal] = useState(null);
  const [resetModal,  setResetModal]  = useState(null);
  const [upgradeModal,setUpgradeModal]= useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, pend] = await Promise.all([api.getAllUsers(), api.getPendingApprovals()]);
      setShops(Array.isArray(all) ? all.filter(u => u.role === 'shop' || u.role === 'distributor') : []);
      setPending(Array.isArray(pend) ? pend : []);
    } catch { toast.error('Failed to load shops'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const act = useCallback(async (id, fn, label) => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); toast.success(label); await load(); }
    catch (e) { toast.error(e.message || 'Failed'); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }, [load]);

  const approve       = s => act(s.id, () => api.approveUser(s.id),                                                `${s.name} approved ✅`);
  const suspend       = s => act(s.id, async () => { await api.suspendUser(s.id);   await api.logAdminAction('suspend_user',   s.id, 'active', 'pending'); }, `${s.name} suspended`);
  const unsuspend     = s => act(s.id, async () => { await api.unsuspendUser(s.id); await api.logAdminAction('unsuspend_user', s.id, 'pending', 'active'); }, `${s.name} activated`);
  const del           = s => { if (window.confirm(`Delete ${s.name}? Permanent.`)) act(s.id, async () => { await api.deleteUser(s.id); await api.logAdminAction('delete_user', s.id, null, null); }, `${s.name} deleted`); };

  // Stats
  const stats = useMemo(() => ({
    total:      shops.length,
    active:     shops.filter(s => s.status === 'active').length,
    pending:    pending.filter(u => u.role === 'shop').length,
    // Was only counting Retail pro/enterprise — every paying Service
    // Pro/Enterprise business was silently excluded from this count,
    // same bug class as getAdminStats' MRR calculation fixed alongside
    // this.
    pro:        shops.filter(s => ['pro', 'enterprise', 'service_pro', 'service_enterprise'].includes(s.subscriptionTier)).length,
    trial:      shops.filter(s => s.subscription === 'trial').length,
    noPhotos:   shops.filter(s => !s.shopPhotos?.length).length,
  }), [shops, pending]);

  const filtered = useMemo(() => {
    let list = [...shops];
    if (filter === 'pending')    list = pending.filter(u => u.role === 'shop');
    else if (filter === 'active')  list = list.filter(s => s.status === 'active');
    else if (filter === 'trial')   list = list.filter(s => s.subscription === 'trial');
    else if (filter === 'starter') list = list.filter(s => s.subscriptionTier === 'starter');
    else if (filter === 'pro')     list = list.filter(s => s.subscriptionTier === 'pro');
    else if (filter === 'enterprise') list = list.filter(s => s.subscriptionTier === 'enterprise');
    // Was missing — the three new filter tabs above had no matching
    // branch here at all, so selecting "Svc Starter"/"Svc Pro"/
    // "Svc Enterprise" would silently fall through and show the
    // unfiltered full shop list instead.
    else if (filter === 'service_starter') list = list.filter(s => s.subscriptionTier === 'service_starter');
    else if (filter === 'service_pro') list = list.filter(s => s.subscriptionTier === 'service_pro');
    else if (filter === 'service_enterprise') list = list.filter(s => s.subscriptionTier === 'service_enterprise');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.businessAddress?.toLowerCase().includes(q) || s.gstin?.toLowerCase().includes(q));
    }

    if (sortBy === 'joined_desc') list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === 'joined_asc') list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    else if (sortBy === 'name_asc')   list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  }, [shops, pending, filter, search, sortBy]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12, color: '#64748B', ...font }}>
      <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading shops…
    </div>
  );

  return (
    <div className="admin-tab-content" style={{ ...font }}>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Store size={18} color="#4F46E5" />,    label: 'Total Shops',    value: stats.total,    bg: '#EEF2FF', color: '#4F46E5' },
          { icon: <CheckCircle size={18} color="#10B981"/>,label: 'Active',         value: stats.active,   bg: '#ECFDF5', color: '#10B981' },
          { icon: <Clock size={18} color="#F59E0B" />,    label: 'Pending',        value: stats.pending,  bg: '#FEF3C7', color: '#F59E0B' },
          { icon: <Star size={18} color="#4F46E5" />,     label: 'Pro / Enterprise',value: stats.pro,     bg: '#EEF2FF', color: '#4F46E5' },
          { icon: <Clock size={18} color="#64748B" />,    label: 'On Trial',       value: stats.trial,    bg: '#F1F5F9', color: '#64748B' },
          { icon: <Image size={18} color="#EF4444" />,    label: 'No Photos',      value: stats.noPhotos, bg: '#FEF2F2', color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}20`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Pending Approval Queue ── */}
      {stats.pending > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 16, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#92400E' }}>
              {stats.pending} Shop{stats.pending !== 1 ? 's' : ''} Awaiting Approval
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {pending.filter(u => u.role === 'shop').map(shop => {
              const photos = shop.shopPhotos || [];
              return (
                <div key={shop.id} style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'transform 0.15s' }}
                  onClick={() => setDetailModal(shop)}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {/* Cover */}
                  <div style={{ height: 90, position: 'relative', background: photos[0] ? `url(${photos[0]}) center/cover` : `hsl(${(shop.name||'S').charCodeAt(0) * 7 % 360},55%,85%)`, overflow: 'hidden' }}>
                    {!photos[0] && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: `hsl(${(shop.name||'S').charCodeAt(0) * 7 % 360},55%,40%)` }}>{(shop.name||'S')[0]}</div>}
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 8 }}>
                      {photos.length ? `📸 ${photos.length}` : '⚠️ No photos'}
                    </div>
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: '#F59E0B', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8 }}>PENDING</div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{shop.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>📱 {shop.phone}</div>
                    {shop.businessAddress && <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>📍 {shop.businessAddress}</div>}
                    <button onClick={e => { e.stopPropagation(); setDetailModal(shop); }} style={{ width: '100%', background: 'linear-gradient(135deg,#4F46E5,#4338CA)', border: 'none', color: '#fff', padding: '7px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, ...font }}>
                      <Eye size={12} /> Review & Approve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search + Filters + Sort ── */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, GSTIN…" style={{ ...inp, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }} />
          </div>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, paddingRight: 8 }}>
            <option value="joined_desc">Newest first</option>
            <option value="joined_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
          </select>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
            {[['table', '☰'], ['grid', '⊞']].map(([v, icon]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ width: 32, height: 32, border: 'none', background: viewMode === v ? '#fff' : 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 14, boxShadow: viewMode === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{icon}</button>
            ))}
          </div>
          <button onClick={load} style={{ ...btn('#475569'), height: 36 }}><RefreshCw size={13} />Refresh</button>
        </div>
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${filter === f.key ? '#4F46E5' : '#E5E7EB'}`, background: filter === f.key ? 'rgba(79,70,229,0.08)' : '#fff', color: filter === f.key ? '#4F46E5' : '#475569', fontSize: 12, cursor: 'pointer', fontWeight: filter === f.key ? 700 : 400, ...font, transition: 'all 0.15s' }}>
              {f.label}{filter === f.key && ` (${filtered.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table View ── */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...font }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
                  {['Shop', 'Phone', 'Plan', 'Status', 'Photos', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '11px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                    <Store size={28} color="#CBD5E1" style={{ display: 'block', margin: '0 auto 10px' }} />
                    No shops match your filter
                  </td></tr>
                )}
                {filtered.map(shop => {
                  const tier = shop.subscriptionTier || shop.subscription || 'trial';
                  const photos = shop.shopPhotos || [];
                  const isBusy = busy[shop.id];
                  return (
                    <tr key={shop.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      {/* Shop */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setDetailModal(shop)}>
                          <Avatar shop={shop} size={34} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</div>
                            {shop.shopCategory && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{shop.shopCategory}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Phone */}
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#475569' }}>{shop.phone}</td>
                      {/* Plan */}
                      <td style={{ padding: '13px 16px' }}><PlanBadge tier={tier} /></td>
                      {/* Status */}
                      <td style={{ padding: '13px 16px' }}><StatusDot status={shop.status} /></td>
                      {/* Photos */}
                      <td style={{ padding: '13px 16px' }}>
                        {photos.length > 0
                          ? <div style={{ display: 'flex', gap: 3 }}>
                              {photos.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'cover', border: '1px solid #E2E8F0' }} />)}
                              {photos.length > 3 && <span style={{ fontSize: 10, color: '#94A3B8', alignSelf: 'center', marginLeft: 2 }}>+{photos.length - 3}</span>}
                            </div>
                          : <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>⚠️ None</span>}
                      </td>
                      {/* Joined */}
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
                        {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                          <button disabled={isBusy} onClick={() => setDetailModal(shop)} style={{ ...btn('#4F46E5'), height: 30 }}><Eye size={11} />View</button>
                          {shop.status === 'pending'
                            ? <button disabled={isBusy} onClick={() => setDetailModal(shop)} style={{ ...btn('#F59E0B'), height: 30 }}><CheckCircle size={11} />Review</button>
                            : shop.status === 'active'
                              ? <button disabled={isBusy} onClick={() => suspend(shop)} style={{ ...btn('#F59E0B'), height: 30 }}><XCircle size={11} />Suspend</button>
                              : <button disabled={isBusy} onClick={() => unsuspend(shop)} style={{ ...btn('#10B981'), height: 30 }}><ShieldCheck size={11} />Activate</button>
                          }
                          <button disabled={isBusy} onClick={() => setUpgradeModal(shop)} style={{ ...btn('#64748B'), height: 30 }}><ChevronDown size={11} />Plan</button>
                          <button disabled={isBusy} onClick={() => del(shop)} style={{ ...btn('#EF4444'), height: 30 }}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grid View ── */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94A3B8', padding: '48px 0' }}>No shops match your filter</div>
          )}
          {filtered.map(shop => {
            const photos = shop.shopPhotos || [];
            const tier = shop.subscriptionTier || shop.subscription || 'trial';
            return (
              <div key={shop.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => setDetailModal(shop)}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}>
                {/* Cover */}
                <div style={{ height: 88, position: 'relative', background: photos[0] ? `url(${photos[0]}) center/cover` : `hsl(${(shop.name||'S').charCodeAt(0) * 7 % 360},50%,88%)`, overflow: 'hidden' }}>
                  {!photos[0] && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: `hsl(${(shop.name||'S').charCodeAt(0) * 7 % 360},50%,40%)` }}>{(shop.name||'S')[0]}</div>}
                  <div style={{ position: 'absolute', top: 7, right: 7 }}><StatusDot status={shop.status} /></div>
                  {photos.length > 0 && <div style={{ position: 'absolute', bottom: 7, right: 7, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 8 }}>📸 {photos.length}</div>}
                </div>
                {/* Body */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <Avatar shop={shop} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{shop.phone}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                    <PlanBadge tier={tier} />
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={e => { e.stopPropagation(); setDetailModal(shop); }} style={{ ...btn('#4F46E5'), flex: 1, height: 30, justifyContent: 'center', ...font }}>View</button>
                    {shop.status === 'pending' && (
                      <button onClick={e => { e.stopPropagation(); approve(shop); }} style={{ ...btn('#10B981'), flex: 1, height: 30, justifyContent: 'center', ...font }}>Approve</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {resetModal  && <ResetPassModal shop={resetModal}   onClose={() => setResetModal(null)}   onDone={() => { setResetModal(null);   load(); }} />}
      {upgradeModal && <UpgradeModal  shop={upgradeModal} onClose={() => setUpgradeModal(null)} onDone={() => { setUpgradeModal(null); load(); }} />}
      {detailModal  && (
        <ShopDetailModal
          shop={detailModal}
          onClose={() => setDetailModal(null)}
          onApprove={s => { approve(s); setDetailModal(null); }}
          onSuspend={s => { suspend(s); setDetailModal(null); }}
          onActivate={s => { unsuspend(s); setDetailModal(null); }}
          onUpgrade={action => {
            const s = detailModal;
            setDetailModal(null);
            if (action === 'reset') setTimeout(() => setResetModal(s), 150);
            else setTimeout(() => setUpgradeModal(s), 150);
          }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
