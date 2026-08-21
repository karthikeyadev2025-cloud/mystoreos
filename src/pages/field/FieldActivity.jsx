// ═══════════════════════════════════════════════════════════════════
// FIELD ACTIVITY — where is everyone right now
//
// Deliberately NOT continuous GPS tracking. That drains a rep's phone
// all day for precision nobody asked for. This is built entirely from
// the check-in/check-out data every rep already generates just by
// doing their job (Field Run) — "checked in, not yet checked out"
// means "currently there," which is what a distributor actually wants
// to know, not a live dot moving on a map every 10 seconds.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, RefreshCw, MapPin, CheckCircle2, SkipForward, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function FieldActivity() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fieldApi.getFieldActivityToday(distId);
        if (!cancelled) setActivity(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load activity');
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const refresh = () => { setRefreshing(true); setReloadKey(k => k + 1); };

  const activeNow = activity.filter(a => a.currentShopName).length;

  const S = {
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: 0 }}>Field Activity</h1>
        <button onClick={refresh} disabled={refreshing}
          style={{ background: 'var(--c-line-soft)', color: 'var(--c-ink-2)', border: '1px solid var(--c-line)', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 20px' }}>
        Built from check-in/check-out activity, not live GPS tracking — nothing drains a rep's phone for this.
      </p>

      {activity.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-faint)', padding: 40 }}>
          No field reps assigned yet.
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: 'var(--c-primary-hover)' }}>
            {activeNow} of {activity.length} rep{activity.length === 1 ? '' : 's'} currently checked in at a shop
          </div>

          {activity.map(a => (
            <div key={a.userId} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-ink)' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 2 }}>
                    {a.vehicleCode ? `${a.vehicleCode} · ` : ''}{a.phone}
                  </div>

                  {a.currentShopName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--c-success-strong)' }}>
                      <MapPin size={13} /> Currently at {a.currentShopName}
                      <span style={{ color: 'var(--c-faint)', fontWeight: 500 }}>· since {timeAgo(a.currentSince)}</span>
                    </div>
                  ) : a.lastActivityShopName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--c-muted)' }}>
                      <Clock size={13} /> Last at {a.lastActivityShopName} · {timeAgo(a.lastActivityAt)}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-line-strong)' }}>No activity yet today</div>
                  )}
                </div>

                {a.totalToday > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: 'var(--c-success-strong)' }}>
                      <CheckCircle2 size={13} /> {a.visitedCount}
                    </span>
                    {a.skippedCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: 'var(--c-faint)' }}>
                        <SkipForward size={13} /> {a.skippedCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
