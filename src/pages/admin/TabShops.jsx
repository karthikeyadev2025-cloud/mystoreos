import { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle, XCircle, Trash2, Key, ShieldCheck, RefreshCw, ChevronDown, AlertTriangle, Eye, EyeOff, Store, Phone, MapPin, Image, X } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const TIER_COLORS = { starter: '#f59e0b', pro: '#4F46E5', enterprise: '#10b981', trial: '#64748b' };
const TIER_LABELS = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', trial: 'Trial' };

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  badge: (tier) => ({ background: `${TIER_COLORS[tier] || '#64748b'}15`, color: TIER_COLORS[tier] || '#64748b', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }),
  btn: (color = '#4F46E5') => ({ height: '36px', background: `${color}15`, border: `1px solid ${color}30`, color, borderRadius: '8px', padding: '0 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }),
  input: { background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#0F172A', padding: '8px 12px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none' },
  th: { color: '#64748B', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#0F172A', fontSize: '13px', padding: '14px 16px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
};

const FILTERS = ['all', 'trial', 'starter', 'pro', 'enterprise', 'pending'];

// ── Shop Verification Modal ─────────────────────────────────────────────────
function ShopVerifyModal({ shop, onClose, onApprove, onSuspend }) {
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const photos = shop.shopPhotos || [];

  const doApprove = async () => {
    setBusy(true);
    try { await onApprove(shop); onClose(); }
    catch { toast.error('Failed'); }
    finally { setBusy(false); }
  };
  const doSuspend = async () => {
    setBusy(true);
    try { await onSuspend(shop); onClose(); }
    catch { toast.error('Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: shop.status === 'pending' ? 'linear-gradient(135deg,#FEF3C7,#FFF7ED)' : 'linear-gradient(135deg,#ECFDF5,#F0FDF4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {shop.logo
              ? <img src={shop.logo} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '2px solid #E5E7EB' }} />
              : <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#4F46E5,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>{(shop.name||'S')[0]}</div>
            }
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{shop.name}</h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={S.badge(shop.subscriptionTier || shop.subscription || 'trial')}>{TIER_LABELS[shop.subscriptionTier || shop.subscription] || 'Trial'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: shop.status === 'active' ? '#10B981' : '#F59E0B', background: shop.status === 'active' ? '#ECFDF5' : '#FEF3C7', border: `1px solid ${shop.status === 'active' ? '#6EE7B7' : '#FCD34D'}`, padding: '2px 8px', borderRadius: 20 }}>
                  {shop.status === 'active' ? '● Active' : '● Pending Approval'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { icon: Phone, label: 'Phone', value: shop.phone },
              { icon: MapPin, label: 'Location', value: shop.businessAddress || (shop.latitude ? `${shop.latitude?.toFixed(4)}, ${shop.longitude?.toFixed(4)}` : '—') },
              { icon: Store, label: 'Category', value: shop.shopCategory || '—' },
              { icon: Store, label: 'GSTIN', value: shop.gstin || '—' },
              { icon: Store, label: 'Joined', value: shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
              { icon: Store, label: 'UPI ID', value: shop.upiId || '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon size={14} color="#64748B" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 2, wordBreak: 'break-all' }}>{value || '—'}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Shop Photos */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Image size={15} color="#64748B" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Shop Photos ({photos.length})</span>
            </div>
            {photos.length === 0 ? (
              <div style={{ background: '#F8FAFC', border: '2px dashed #CBD5E1', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                ⚠️ No shop photos uploaded — consider requesting photos before approval
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {photos.map((src, i) => (
                  <div key={i} onClick={() => setLightbox(i)} style={{ cursor: 'zoom-in', position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0', aspectRatio: '4/3' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {i === 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', fontSize: 9, fontWeight: 800, color: '#fff', padding: '3px 6px', textAlign: 'center' }}>COVER</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
            {shop.status === 'pending' ? (
              <>
                <button disabled={busy} onClick={doApprove} style={{ flex: 2, background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CheckCircle size={16} /> Approve Shop
                </button>
                <button disabled={busy} onClick={onClose} style={{ flex: 1, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', padding: '13px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Review Later
                </button>
              </>
            ) : (
              <>
                <button disabled={busy} onClick={doSuspend} style={{ flex: 1, background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <XCircle size={14} /> Suspend
                </button>
                <button disabled={busy} onClick={onClose} style={{ flex: 1, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 20 }}>
          <img src={photos[lightbox]} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {lightbox > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>‹</button>}
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{lightbox + 1} / {photos.length}</span>
            {lightbox < photos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>›</button>}
          </div>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function ResetPassModal({ shop, onClose, onDone }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await api.adminResetPassword(shop.id, pass);
      await api.logAdminAction('reset_password', shop.id, null, null);
      toast.success(`Password reset for ${shop.name}`);
      onDone();
    } catch { toast.error('Reset failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}>Set new password for <b>{shop.name}</b></p>
        <input value={pass} onChange={e => setPass(e.target.value)} placeholder="New password (min 6 chars)" type="password" style={{ ...S.input, width: '100%', marginBottom: '16px' }} required />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>{busy ? 'Saving...' : 'Reset'}</button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#475569', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function UpgradeModal({ shop, onClose, onDone }) {
  const [tier, setTier] = useState(shop.subscriptionTier || 'starter');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.updateUserSubscription(shop.id, tier, null);
      await api.logAdminAction('upgrade_plan', shop.id, shop.subscriptionTier, tier);
      toast.success(`${shop.name} upgraded to ${TIER_LABELS[tier]}`);
      onDone();
    } catch { toast.error('Failed to update plan'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Change Plan</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}><b>{shop.name}</b></p>
        {['trial', 'starter', 'pro', 'enterprise'].map(t => (
          <button key={t} onClick={() => setTier(t)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tier === t ? TIER_COLORS[t] : '#E5E7EB'}`, background: tier === t ? `${TIER_COLORS[t]}15` : 'transparent', color: tier === t ? TIER_COLORS[t] : '#475569', cursor: 'pointer', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif', textAlign: 'left' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TIER_COLORS[t], display: 'inline-block' }} />
            {TIER_LABELS[t]}
          </button>
        ))}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>{busy ? 'Saving...' : 'Apply'}</button>
          <button onClick={onClose} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#475569', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function TabShops() {
  const [shops, setShops] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [resetModal, setResetModal] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [busy, setBusy] = useState({});

  const load = async () => {
    try {
      const [all, pend] = await Promise.all([api.getAllUsers(), api.getPendingApprovals()]);
      setShops(all.filter(u => u.role === 'shop' || u.role === 'staff'));
      setPending(pend);
    } catch { toast.error('Failed to load shops'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    let list = shops;
    if (filter === 'pending') list = pending.filter(u => u.role === 'shop');
    else if (filter !== 'all') list = shops.filter(s => (s.subscriptionTier || 'trial') === filter || s.subscription === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q));
    }
    return list;
  }, [shops, pending, filter, search]);

  const act = async (id, fn, label) => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); await load(); toast.success(label); }
    catch { toast.error(`${label} failed`); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  };

  const approve = (u) => act(u.id, () => api.approveUser(u.id), `${u.name} approved`);
  const suspend = (u) => act(u.id, async () => { await api.suspendUser(u.id); await api.logAdminAction('suspend_user', u.id, 'active', 'pending'); }, `${u.name} suspended`);
  const unsuspend = (u) => act(u.id, async () => { await api.unsuspendUser(u.id); await api.logAdminAction('unsuspend_user', u.id, 'pending', 'active'); }, `${u.name} activated`);
  const toggleVisibility = (u) => act(u.id, async () => {
    const next = !u.hideFromSearch;
    await api.setShopVisibility(u.id, next);
    await api.logAdminAction('set_shop_visibility', u.id, u.hideFromSearch ? 'hidden' : 'visible', next ? 'hidden' : 'visible');
  }, u.hideFromSearch ? `${u.name} is now visible to customers` : `${u.name} hidden from customers`);
  const del = (u) => {
    if (!window.confirm(`Delete ${u.name}? This is permanent.`)) return;
    act(u.id, async () => { await api.deleteUser(u.id); await api.logAdminAction('delete_user', u.id, null, null); }, `${u.name} deleted`);
  };

  if (loading) return <div style={{ textAlign: 'center', color: '#64748B', padding: '60px' }}>Loading shops...</div>;

  const now = new Date().getTime();
  const expiredTrials = shops.filter(s => s.subscription === 'trial' && s.trialStartedAt && (now - new Date(s.trialStartedAt).getTime()) > 7 * 864e5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600, margin: 0 }}>Shop Management</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: '4px 0 0' }}>{shops.length} shops · {pending.filter(u=>u.role==='shop').length} pending · {expiredTrials.length} expired trials</p>
        </div>
        <button onClick={load} style={S.btn('#475569')}><RefreshCw size={13} />Refresh</button>
      </div>

      {expiredTrials.length > 0 && (
        <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={16} color="#E11D48" />
          <span style={{ color: '#E11D48', fontSize: '13px', fontWeight: 500 }}><b>{expiredTrials.length}</b> shop(s) with expired trials — consider converting or cleaning up.</span>
        </div>
      )}

      {/* Pending Approval Queue */}
      {pending.filter(u => u.role === 'shop').length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <AlertTriangle size={18} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#92400E' }}>
              {pending.filter(u => u.role === 'shop').length} Shop{pending.filter(u => u.role === 'shop').length !== 1 ? 's' : ''} Awaiting Approval
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {pending.filter(u => u.role === 'shop').map(shop => {
              const photos = shop.shopPhotos || [];
              return (
                <div key={shop.id} style={{ background: '#FFFFFF', border: '1px solid #FCD34D', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  {/* Cover photo or gradient */}
                  <div style={{ height: 100, background: photos[0] ? `url(${photos[0]}) center/cover` : 'linear-gradient(135deg,#4F46E5,#3B82F6)', position: 'relative' }}>
                    {!photos[0] && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#fff', opacity: 0.7 }}>
                        {(shop.name||'S')[0]}
                      </div>
                    )}
                    {photos.length > 1 && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                        +{photos.length} photos
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: '#F59E0B', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8 }}>
                      PENDING
                    </div>
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {shop.logo
                        ? <img src={shop.logo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }} />
                        : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{(shop.name||'S')[0]}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>📱 {shop.phone}</div>
                      </div>
                    </div>
                    {shop.businessAddress && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {shop.businessAddress}</div>}
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: '10px' }}>
                      Joined {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setVerifyModal(shop)} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', padding: '8px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <Eye size={12} /> Review & Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" style={{ ...S.input, width: '100%', paddingLeft: '32px' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${filter === f ? '#4F46E5' : '#E5E7EB'}`, background: filter === f ? 'rgba(79,70,229,0.08)' : '#FFFFFF', color: filter === f ? '#4F46E5' : '#475569', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: filter === f ? 600 : 400, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th style={S.th}>Shop</th>
                <th style={S.th}>Phone</th>
                <th style={S.th}>Plan</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Joined</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#64748B', padding: '40px' }}>No shops found</td></tr>
              )}
              {filtered.map(shop => {
                const tier = shop.subscriptionTier || shop.subscription || 'trial';
                const isBusy = busy[shop.id];
                return (
                  <tr>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {shop.logo
                          ? <img src={shop.logo} alt="" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
                          : <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#4F46E5,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(shop.name||'S')[0]}</div>
                        }
                        <span title={shop.name} style={{ fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{shop.name}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#475569' }}>{shop.phone}</td>
                    <td style={S.td}><span style={S.badge(tier)}>{TIER_LABELS[tier] || tier}</span></td>
                    <td style={S.td}>
                      <span style={{ color: shop.status === 'active' ? '#10B981' : '#F59E0B', fontSize: '12px', fontWeight: 600 }}>
                        {shop.status === 'active' ? '● Active' : '● Pending'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#64748B', fontSize: '12px' }}>{shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ ...S.td, minWidth: '320px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                        {shop.status === 'pending'
                          ? <button disabled={isBusy} onClick={() => setVerifyModal(shop)} style={S.btn('#F59E0B')}><Eye size={12} />Review</button>
                          : shop.status === 'active'
                            ? <button disabled={isBusy} onClick={() => suspend(shop)} style={S.btn('#F59E0B')}><XCircle size={12} />Suspend</button>
                            : <button disabled={isBusy} onClick={() => unsuspend(shop)} style={S.btn('#10B981')}><ShieldCheck size={12} />Activate</button>
                        }
                        <button disabled={isBusy} onClick={() => setVerifyModal(shop)} style={S.btn('#0EA5E9')}><Eye size={12} />View</button>
                        <button disabled={isBusy} onClick={() => setUpgradeModal(shop)} style={S.btn('#4F46E5')}><ChevronDown size={12} />Plan</button>
                        <button disabled={isBusy} onClick={() => toggleVisibility(shop)} style={S.btn(shop.hideFromSearch ? '#64748B' : '#0EA5E9')}>{shop.hideFromSearch ? <><EyeOff size={12} />Hidden</> : <><Eye size={12} />Visible</>}</button>
                        <button disabled={isBusy} onClick={() => setResetModal(shop)} style={S.btn('#475569')}><Key size={12} />Reset PW</button>
                        <button disabled={isBusy} onClick={() => del(shop)} style={S.btn('#EF4444')}><Trash2 size={12} />Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {resetModal && <ResetPassModal shop={resetModal} onClose={() => setResetModal(null)} onDone={() => { setResetModal(null); load(); }} />}
      {upgradeModal && <UpgradeModal shop={upgradeModal} onClose={() => setUpgradeModal(null)} onDone={() => { setUpgradeModal(null); load(); }} />}
      {verifyModal && (
        <ShopVerifyModal
          shop={verifyModal}
          onClose={() => setVerifyModal(null)}
          onApprove={async (s) => { await approve(s); setVerifyModal(null); }}
          onSuspend={async (s) => { await suspend(s); setVerifyModal(null); }}
        />
      )}
    </div>
  );
}
