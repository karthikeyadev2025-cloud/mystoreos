import { useSubscription } from '../hooks/useSubscription';
import { FEATURE_PLAN_LABEL } from '../lib/features';

// Renders children if the current user's plan includes `feature`.
// Falls back to <LockedFeature> (or a custom `fallback`) otherwise.
export function PlanGate({ feature, children, fallback }) {
  const { hasFeature } = useSubscription();
  if (hasFeature(feature)) return children;
  return fallback ?? <LockedFeature feature={feature} />;
}

// Inline locked-feature placeholder with upgrade CTA.
// variant: 'block' (default), 'compact' (inline badge), 'button' (overlay button)
export function LockedFeature({ feature, compact = false, variant = 'block', onUpgrade }) {
  const label = FEATURE_PLAN_LABEL[feature] || 'a higher plan';

  const PLAN_COLOR = {
    'Starter Plan': 'var(--c-accent-hover)',
    'Pro Plan': 'var(--c-primary)',
    'Enterprise Plan': 'var(--c-violet)',
  };
  const color = PLAN_COLOR[label] || 'var(--c-primary)';

  const handleUpgrade = () => {
    if (onUpgrade) { onUpgrade(); return; }
    // Navigate to settings tab with plan selector
    const event = new CustomEvent('openPlanSelector');
    window.dispatchEvent(event);
  };

  if (compact) {
    return (
      <button
        onClick={handleUpgrade}
        title={`Requires ${label}`}
        style={{ fontSize: '10px', color, background: color + '15', border: `1px solid ${color}30`, padding: '2px 8px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}
      >
        🔒 {label}
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleUpgrade}
        style={{ width: '100%', background: `linear-gradient(135deg,${color},${color}cc)`, color: 'var(--c-surface)', border: 'none', padding: '11px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 12px ${color}30` }}
      >
        🔒 Unlock — Requires {label}
      </button>
    );
  }

  // Default block variant
  return (
    <div style={{ background: `linear-gradient(135deg,${color}08,${color}04)`, border: `1.5px dashed ${color}40`, borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔒</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-ink)' }}>Feature Locked</div>
          <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>
            Requires <span style={{ color, fontWeight: 700 }}>{label}</span> to use
          </div>
        </div>
      </div>
      <button
        onClick={handleUpgrade}
        style={{ background: `linear-gradient(135deg,${color},${color}dd)`, color: 'var(--c-surface)', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', boxShadow: `0 2px 8px ${color}30` }}
      >
        ⚡ Upgrade
      </button>
    </div>
  );
}

// Full-screen overlay displayed when a shop's trial or paid plan has expired.
export function TrialExpiredOverlay({ planLabel, onUpgrade }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '460px', width: '100%', background: 'linear-gradient(135deg, var(--c-ink), var(--c-ink))', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '20px', padding: '40px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1 }}>⏰</div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', fontWeight: '800', color: 'white' }}>
          Your Trial Has Ended
        </h2>
        <p style={{ margin: '0 0 28px 0', fontSize: '14px', color: 'var(--c-faint)', lineHeight: '1.6' }}>
          Your free trial is over. Upgrade to keep your billing, inventory, and reports — all your data is safe.
        </p>
        <button
          onClick={onUpgrade}
          style={{ width: '100%', background: 'linear-gradient(135deg, var(--c-violet), var(--c-primary))', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', marginBottom: '14px', boxShadow: '0 4px 16px rgba(79,70,229,0.4)' }}
        >
          ⚡ Choose a Plan →
        </button>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-ink-2)' }}>Current plan: {planLabel}</p>
      </div>
    </div>
  );
}
