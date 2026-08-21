import { useState, useEffect, useRef } from 'react';
import { Bell, X, ShoppingCart, Calendar, CreditCard, UserPlus, Info, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

// Notification center — the bell icon that lives in a topbar and its
// slide-out drawer / bottom-sheet on mobile.
//
// Props:
//   userId  — REQUIRED. If null, the bell is hidden (unauthenticated
//             users don't have an inbox).
//   inline  — if true, renders as a plain button (no absolute drawer
//             positioning); useful for embedding inside a menu. Rarely
//             used; default false.
//
// Emits an in-app toast via onToast(row) when a new notification
// arrives while the app is open — otherwise the bell badge just
// increments silently.
const CATEGORY = {
  order:   { Icon: ShoppingCart, color: 'var(--c-primary)', bg: 'var(--c-primary-soft)' },
  booking: { Icon: Calendar,     color: 'var(--c-success)', bg: 'var(--c-success-soft)' },
  credit:  { Icon: CreditCard,   color: 'var(--c-warning)', bg: 'var(--c-warning-soft)' },
  signup:  { Icon: UserPlus,     color: 'var(--c-violet)', bg: 'var(--c-violet-soft)' },
  info:    { Icon: Info,         color: 'var(--c-muted)', bg: 'var(--c-line-soft)' },
  // Was falling through to the generic grey 'info' style — completely
  // inadequate for an emergency alert. Red, unmissable, distinct from
  // every other category on purpose.
  sos:            { Icon: AlertTriangle, color: 'var(--c-surface)', bg: 'var(--c-danger-strong)' },
  overdue_checkin:{ Icon: AlertTriangle, color: 'var(--c-warning-strong)', bg: 'var(--c-warning-soft)' },
  // New — the welcome notification sent at signup had nowhere to
  // render distinctly, would have fallen through to the same grey
  // 'info' style as a routine system message.
  welcome:        { Icon: UserPlus, color: 'var(--c-success-strong)', bg: 'var(--c-success-soft)' },
  // New — payment confirmations (subscription upgrades, add-on
  // purchases) had nowhere to render distinctly before tonight.
  payment:        { Icon: CreditCard, color: 'var(--c-cyan)', bg: 'var(--c-cyan-soft)' },
};

function relTime(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

export default function NotificationCenter({ userId, onToast }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead, remove } = useNotifications(userId, {
    onNew: (row) => {
      // Fire an in-app toast for every fresh notification arriving via
      // realtime (only after initial hydration — see hook).
      if (typeof onToast === 'function') onToast(row);
    },
  });

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!userId) return null;

  const handleClick = async (row) => {
    if (!row.read) markRead(row.id);
    if (row.action_url) {
      try { navigate(row.action_url); } catch { /* ignore */ }
    }
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ''}`}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, width: 'auto' }}
      >
        <Bell size={20} color="var(--c-ink-2)" />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--c-danger)', color: 'var(--c-surface)', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 0 0 2px var(--c-surface)' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={drawerRef} className="notif-drawer" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 480,
          background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 14,
          boxShadow: '0 20px 40px -10px rgba(15,23,42,0.2)',
          display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-line-soft)' }}>
            <div style={{ fontWeight: 700, color: 'var(--c-ink)', fontSize: 14 }}>
              Notifications {unread > 0 && <span style={{ color: 'var(--c-muted)', fontWeight: 500 }}>({unread} new)</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--c-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4, width: 'auto' }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 }}>
                <Bell size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>You're all caught up.</div>
              </div>
            ) : items.map(row => {
              const cat = CATEGORY[row.category] || CATEGORY.info;
              const { Icon } = cat;
              return (
                <div
                  key={row.id}
                  onClick={() => handleClick(row)}
                  style={{
                    display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--c-bg)',
                    background: row.read ? 'var(--c-surface)' : 'rgba(79,70,229,0.03)',
                    transition: 'background .1s',
                  }}
                >
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={cat.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: row.read ? 500 : 700, color: 'var(--c-ink)', lineHeight: 1.3 }}>{row.title}</div>
                      <span style={{ fontSize: 11, color: 'var(--c-faint)', flexShrink: 0 }}>{relTime(row.created_at)}</span>
                    </div>
                    {row.body && <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2, lineHeight: 1.35 }}>{row.body}</div>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(row.id); }}
                    aria-label="Dismiss"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-line-strong)', padding: 2, alignSelf: 'flex-start', width: 'auto' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .notif-drawer {
            position: fixed !important;
            top: auto !important;
            /* Was bottom: 0 — this component is used on pages that
               ALSO have their own fixed bottom nav (ShopDashboard,
               DistributorDashboard), both also pinned to bottom: 0.
               The two fixed elements directly overlapped each other,
               with the page's own nav bar rendering on top and
               visually cutting off the last notification(s) in this
               drawer. Raised above a typical mobile bottom nav's
               height (roughly 64px) plus a safe-area allowance for
               notched/gesture-nav phones, so the drawer sits cleanly
               above the nav instead of behind it. */
            left: 0 !important; right: 0 !important;
            bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
            width: 100% !important; max-width: 100% !important;
            max-height: 70vh !important;
            border-radius: 20px !important;
            box-shadow: 0 -8px 30px rgba(15,23,42,0.15) !important;
          }
        }
      `}</style>
    </div>
  );
}
