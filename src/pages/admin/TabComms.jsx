import { useState, useEffect } from 'react';
import { Send, MessageSquare, Bell, CheckCircle, RefreshCw, Megaphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useSiteConfig } from '../../lib/siteConfig';
import { toast } from 'react-toastify';

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', marginBottom: '20px' },
  label: { color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%' },
  textarea: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '10px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%', resize: 'vertical', minHeight: '80px' },
  sendBtn: (busy) => ({ background: busy ? '#64748b' : '#f43f5e', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px 20px', cursor: busy ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
  sectionTitle: { color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '4px' },
  sectionSub: { color: '#64748b', fontSize: '12px', marginBottom: '18px' },
};

const ANN_TYPE_COLORS = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', error: '#ef4444' };
const ANN_TYPES = ['info', 'warning', 'success', 'error'];

function SectionHeader({ icon: Icon, title, sub, color = '#f43f5e' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
      <div style={{ background: `${color}22`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
      <div><div style={S.sectionTitle}>{title}</div><div style={S.sectionSub}>{sub}</div></div>
    </div>
  );
}

export default function TabComms() {
  const { updateConfigs } = useSiteConfig();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [annText, setAnnText] = useState('');
  const [annType, setAnnType] = useState('info');
  const [busyAnn, setBusyAnn] = useState(false);

  const [waNumber, setWaNumber] = useState('');
  const [waMessage, setWaMessage] = useState('');

  const [bulkRole, setBulkRole] = useState('shop');
  const [bulkTier, setBulkTier] = useState('all');
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkStats, setBulkStats] = useState(null);
  const [busyBulk, setBusyBulk] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.getAdminAuditLog().then(log => {
        setHistory(log.filter(e => e.action === 'send_announcement').slice(0, 20));
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const broadcast = async (e) => {
    e.preventDefault();
    if (!annText.trim()) return toast.error('Message required');
    setBusyAnn(true);
    try {
      await api.saveAnnouncement({ text: annText, type: annType });
      await updateConfigs({ announcementText: annText, announcementType: annType, announcementActive: true });
      await api.logAdminAction('send_announcement', 'comms', null, annText);
      toast.success('Announcement broadcast!');
      setHistory(h => [{ action: 'send_announcement', ts: new Date().toISOString(), oldVal: annType, newVal: annText }, ...h.slice(0, 19)]);
      setAnnText('');
    } catch { toast.error('Broadcast failed'); }
    finally { setBusyAnn(false); }
  };

  const openWhatsApp = () => {
    const num = waNumber.replace(/\D/g, '');
    if (!num) return toast.error('Enter a phone number');
    const encoded = encodeURIComponent(waMessage || 'Hello from MyStore OS!');
    window.open(`https://wa.me/91${num}?text=${encoded}`, '_blank');
  };

  const previewBulk = async () => {
    setBusyBulk(true);
    try {
      const all = await api.getAllUsers();
      let target = all.filter(u => u.role === bulkRole);
      if (bulkTier !== 'all' && bulkRole === 'shop') target = target.filter(u => (u.subscriptionTier || 'starter') === bulkTier);
      setBulkStats({ count: target.length, phones: target.slice(0, 5).map(u => u.phone) });
    } catch { toast.error('Failed'); }
    finally { setBusyBulk(false); }
  };

  const sendBulkWhatsApp = () => {
    if (!bulkStats) return toast.error('Preview first');
    if (!bulkMsg.trim()) return toast.error('Message required');
    const encoded = encodeURIComponent(bulkMsg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    toast.info(`WhatsApp Web opened — paste and send to ${bulkStats.count} contacts`);
  };

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Communications</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Broadcast announcements and manage platform-wide messaging</p>
      </div>

      <div style={S.card}>
        <SectionHeader icon={Bell} title="Platform Announcement" sub="Banner broadcast to all logged-in users (dismissable)" color="#f43f5e" />
        <form onSubmit={broadcast}>
          <div style={{ marginBottom: '14px' }}>
            <label style={S.label}>Message</label>
            <textarea value={annText} onChange={e => setAnnText(e.target.value)} placeholder="e.g. Scheduled maintenance tonight 2–4 AM IST. Save your work." style={S.textarea} rows={3} required />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {ANN_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setAnnType(t)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${annType === t ? ANN_TYPE_COLORS[t] : 'rgba(255,255,255,0.1)'}`, background: annType === t ? `${ANN_TYPE_COLORS[t]}18` : 'transparent', color: annType === t ? ANN_TYPE_COLORS[t] : '#94a3b8', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Outfit, sans-serif' }}>
                {t}
              </button>
            ))}
          </div>
          <button type="submit" disabled={busyAnn} style={S.sendBtn(busyAnn)}><Megaphone size={14} />{busyAnn ? 'Broadcasting...' : 'Broadcast to All Users'}</button>
        </form>

        {history.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Broadcasts</div>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <CheckCircle size={14} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f8fafc', fontSize: '13px' }}>{h.newVal || '(message)'}</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>{h.ts ? new Date(h.ts).toLocaleString('en-IN') : ''}</div>
                </div>
                <span style={{ background: `${ANN_TYPE_COLORS[h.oldVal] || '#3b82f6'}22`, color: ANN_TYPE_COLORS[h.oldVal] || '#3b82f6', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, textTransform: 'capitalize' }}>{h.oldVal || 'info'}</span>
              </div>
            ))}
          </div>
        )}
        {loading && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '12px' }}>Loading history...</div>}
      </div>

      <div style={S.card}>
        <SectionHeader icon={MessageSquare} title="WhatsApp Direct Message" sub="Open WhatsApp Web to send a message to any number" color="#25d366" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={S.label}>Phone Number</label>
            <input value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="9876543210" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Message</label>
            <input value={waMessage} onChange={e => setWaMessage(e.target.value)} placeholder="Your message…" style={S.input} />
          </div>
        </div>
        <button onClick={openWhatsApp} style={{ background: '#25d36622', border: '1px solid #25d36644', color: '#25d366', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Send size={14} />Open WhatsApp Web
        </button>
      </div>

      <div style={S.card}>
        <SectionHeader icon={RefreshCw} title="Bulk WhatsApp Campaign" sub="Target a segment and open WhatsApp with a pre-filled message" color="#8b5cf6" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={S.label}>User Role</label>
            <select value={bulkRole} onChange={e => { setBulkRole(e.target.value); setBulkStats(null); }} style={{ ...S.input, cursor: 'pointer' }}>
              {['shop', 'customer', 'distributor', 'ca'].map(r => <option key={r} value={r} style={{ background: '#1e293b' }}>{r}</option>)}
            </select>
          </div>
          {bulkRole === 'shop' && (
            <div>
              <label style={S.label}>Filter by Tier</label>
              <select value={bulkTier} onChange={e => { setBulkTier(e.target.value); setBulkStats(null); }} style={{ ...S.input, cursor: 'pointer' }}>
                {['all', 'trial', 'starter', 'pro', 'enterprise'].map(t => <option key={t} value={t} style={{ background: '#1e293b' }}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={S.label}>Message Template</label>
          <textarea value={bulkMsg} onChange={e => setBulkMsg(e.target.value)} placeholder="Hello! This is a message from MyStore OS…" style={S.textarea} rows={3} />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={previewBulk} disabled={busyBulk} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600 }}>{busyBulk ? 'Counting...' : 'Preview Audience'}</button>
          {bulkStats && (
            <>
              <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>{bulkStats.count} users targeted</span>
              <button onClick={sendBulkWhatsApp} style={S.sendBtn(false)}><Send size={14} />Open WhatsApp</button>
            </>
          )}
        </div>
        {bulkStats && bulkStats.phones.length > 0 && (
          <div style={{ marginTop: '12px', color: '#64748b', fontSize: '12px' }}>
            Sample: {bulkStats.phones.join(', ')}{bulkStats.count > 5 ? ` + ${bulkStats.count - 5} more` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
