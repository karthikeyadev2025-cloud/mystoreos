import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { enableWebPush, disableWebPush, getPushStatus, isPushSupported } from '../lib/pushClient';
import { toast } from 'react-toastify';

// Drop-in toggle for turning Web Push on/off. Renders as a small card
// with a status pill and an action button. Design-matched to the
// enterprise admin/shop UI (rounded card, subtle border).
//
// Usage:
//   <PushToggle userId={user.id} />
//
// Handles all four states: unsupported browser, prompt-pending,
// granted+subscribed, granted+unsubscribed, and denied. The last is
// the trickiest — once a user has clicked "Block", we can't ask again
// programmatically; the message explains they need to unblock in
// browser settings.
export default function PushToggle({ userId }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const s = await getPushStatus();
    setStatus(s);
  };

  useEffect(() => { refresh(); }, []);

  if (!isPushSupported()) {
    return (
      <div style={{ padding: 14, background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 12, fontSize: 12, color: 'var(--c-muted)' }}>
        Push notifications aren't supported in this browser. On iPhone, add MyStore OS to your Home Screen (Safari → Share → Add to Home Screen), then re-open from the icon.
      </div>
    );
  }
  if (!status) return null;

  const permDenied  = status.permission === 'denied';
  const subscribed  = status.permission === 'granted' && status.subscribed;

  const doEnable = async () => {
    setBusy(true);
    try {
      await enableWebPush(userId);
      toast.success('Push notifications enabled');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Could not enable push');
    } finally { setBusy(false); }
  };

  const doDisable = async () => {
    setBusy(true);
    try {
      await disableWebPush();
      toast.info('Push notifications disabled');
      await refresh();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: 16, background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: subscribed ? 'var(--c-success-soft)' : 'var(--c-primary-soft)', border: `1px solid ${subscribed ? 'var(--c-success-soft)' : 'var(--c-primary-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {subscribed ? <Bell size={18} color="var(--c-success)" /> : <BellOff size={18} color="var(--c-primary)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-ink)' }}>
          Push notifications
          {subscribed && <CheckCircle2 size={13} color="var(--c-success)" style={{ marginLeft: 6, verticalAlign: -2 }} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
          {permDenied
            ? 'Blocked. Unblock in your browser site settings, then reload this page.'
            : subscribed
              ? 'You\u2019ll get a system alert for new orders, bookings, and payments \u2014 even when this tab is closed.'
              : 'Get alerts for new orders/bookings even when the tab is closed.'}
        </div>
      </div>
      {permDenied ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--c-danger)', fontSize: 11, fontWeight: 700, background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', padding: '5px 10px', borderRadius: 999 }}>
          <AlertCircle size={12} /> Blocked
        </span>
      ) : subscribed ? (
        <button onClick={doDisable} disabled={busy}
          style={{ background: 'var(--c-bg)', color: 'var(--c-ink-2)', border: '1px solid var(--c-line)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, width: 'auto' }}>
          {busy ? '…' : 'Disable'}
        </button>
      ) : (
        <button onClick={doEnable} disabled={busy || !userId}
          style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, width: 'auto' }}>
          {busy ? '…' : 'Enable'}
        </button>
      )}
    </div>
  );
}
