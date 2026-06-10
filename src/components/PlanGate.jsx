import { useSubscription } from '../hooks/useSubscription';
import { FEATURE_PLAN_LABEL } from '../lib/features';

// Renders children if the current user's plan includes `feature`.
// Falls back to <LockedFeature> (or a custom `fallback`) otherwise.
//
// Usage:
//   <PlanGate feature="tallyExport">
//     <ExportButton />
//   </PlanGate>
export function PlanGate({ feature, children, fallback }) {
  const { hasFeature } = useSubscription();
  if (hasFeature(feature)) return children;
  return fallback ?? <LockedFeature feature={feature} />;
}

// Inline locked-feature placeholder shown when a plan gate blocks content.
// compact=true renders a small inline badge; default renders a full block.
export function LockedFeature({ feature, compact = false }) {
  const label = FEATURE_PLAN_LABEL[feature] || 'higher plan';
  if (compact) {
    return (
      <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>
        🔒 {label}
      </span>
    );
  }
  return (
    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>🔒</span>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>Feature Locked</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          Requires {label} — upgrade in Settings ⚙️
        </div>
      </div>
    </div>
  );
}

// Full-screen overlay displayed when a shop's trial or paid plan has expired.
// Blocks all interaction until they upgrade.
export function TrialExpiredOverlay({ planLabel, onUpgrade }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '460px', width: '100%', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '20px', padding: '40px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1 }}>⏰</div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', fontWeight: '800', color: 'white' }}>
          Your Trial Has Ended
        </h2>
        <p style={{ margin: '0 0 28px 0', fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
          Your 15-day free trial is over. Upgrade to keep your billing, inventory, and reports — all your data is safe.
        </p>
        <button
          onClick={onUpgrade}
          style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', marginBottom: '14px', letterSpacing: '0.3px' }}
        >
          Choose a Plan →
        </button>
        <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>
          Current plan: {planLabel}
        </p>
      </div>
    </div>
  );
}
