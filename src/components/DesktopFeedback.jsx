import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { MessageSquare, Star, Send } from 'lucide-react';

const Stars = ({ n, size = 14 }) => (
  <div style={{ display: 'inline-flex', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={size} fill={i <= n ? '#F59E0B' : 'transparent'} stroke={i <= n ? '#F59E0B' : '#CBD5E1'} strokeWidth={2} />
    ))}
  </div>
);

function FeedbackCard({ fb, onRespond }) {
  const [responding, setResponding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const date = new Date(fb.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const submit = async () => {
    if (!text.trim()) return toast.error('Enter a response');
    setSaving(true);
    try { await api.respondToFeedback(fb.id, text); toast.success('Response saved'); setResponding(false); onRespond(); }
    catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-ink)' }}>{fb.customer_name || 'Anonymous'}</div>
          <div style={{ fontSize: 11, color: 'var(--c-faint)' }}>{fb.customer_phone || 'No phone'} · {date}</div>
        </div>
        <Stars n={fb.rating} />
      </div>
      {fb.comment && <div style={{ fontSize: 13, color: 'var(--c-ink-2)', lineHeight: 1.5, background: 'var(--c-bg)', padding: '10px 14px', borderRadius: 8 }}>{fb.comment}</div>}
      {fb.responded && fb.response_text && (
        <div style={{ background: 'var(--c-primary-soft)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid var(--c-primary)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 4 }}>YOUR RESPONSE</div>
          <div style={{ fontSize: 13, color: 'var(--c-ink-2)', lineHeight: 1.5 }}>{fb.response_text}</div>
        </div>
      )}
      {!fb.responded && !responding && (
        <button onClick={() => setResponding(true)} style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--c-primary)', background: 'var(--c-primary-soft)', color: 'var(--c-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={13} /> Reply
        </button>
      )}
      {responding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Type your response…"
            style={{ width: '100%', padding: 10, border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { setResponding(false); setText(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Send size={12} /> {saving ? 'Sending…' : 'Send Response'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesktopFeedback({ shopId }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'positive' | 'negative' | 'unresponded'

  const load = useCallback(async () => {
    setLoading(true);
    try { setFeedback(await api.getFeedback(shopId)); }
    catch (_e) { toast.error('Failed to load feedback'); }
    finally { setLoading(false); }
  }, [shopId]);
  useEffect(() => { load(); }, [load]);

  const filtered = feedback.filter(f => {
    if (filter === 'positive') return f.rating >= 4;
    if (filter === 'negative') return f.rating <= 2;
    if (filter === 'unresponded') return !f.responded;
    return true;
  });

  const avgRating = feedback.length ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : 0;
  const positive = feedback.filter(f => f.rating >= 4).length;
  const negative = feedback.filter(f => f.rating <= 2).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--c-warning),var(--c-danger))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Star size={22} color="#fff" fill="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--c-ink)' }}>Customer Feedback</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--c-muted)' }}>Reviews and ratings from your customers</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--c-warning-soft)', borderRadius: 12, padding: '14px 18px', border: '1px solid #F59E0B22' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--c-warning)', letterSpacing: '-0.5px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {avgRating} <Star size={18} fill="#F59E0B" stroke="#F59E0B" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0Baa' }}>Average Rating</div>
        </div>
        <div style={{ background: 'var(--c-success-soft)', borderRadius: 12, padding: '14px 18px', border: '1px solid #10B98122' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--c-success)', letterSpacing: '-0.5px' }}>{positive}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#10B981aa' }}>Positive (4-5★)</div>
        </div>
        <div style={{ background: 'var(--c-danger-soft)', borderRadius: 12, padding: '14px 18px', border: '1px solid #EF444422' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--c-danger)', letterSpacing: '-0.5px' }}>{negative}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#EF4444aa' }}>Needs Attention (1-2★)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'all',        label: `All (${feedback.length})` },
          { id: 'unresponded', label: `Unresponded (${feedback.filter(f => !f.responded).length})` },
          { id: 'positive',   label: `Positive (${positive})` },
          { id: 'negative',   label: `Needs attention (${negative})` },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderColor: filter === t.id ? 'var(--c-primary)' : 'var(--c-line)', background: filter === t.id ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: filter === t.id ? 'var(--c-primary)' : 'var(--c-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 48, color: 'var(--c-faint)' }}>Loading feedback…</div>
      : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-faint)' }}>
          <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No feedback yet</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>Feedback appears here once customers submit reviews from the storefront</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(f => <FeedbackCard key={f.id} fb={f} onRespond={load} />)}
        </div>
      )}
    </div>
  );
}
