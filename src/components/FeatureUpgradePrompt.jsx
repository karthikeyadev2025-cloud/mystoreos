import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Shared UI for "this feature is on a paid plan". Two shapes:
//
//   <FeatureUpgradePrompt title="…" body="…" requiredPlan="Pro" />
//     A full inline card — used where the whole feature panel is
//     locked (e.g. Staff manager in Starter tier).
//
//   <UpgradeChip requiredPlan="Pro" />
//     A small badge — used next to individual controls (e.g. the
//     "assign staff" dropdown on a service form) when only that
//     control is disabled.
//
// Both deep-link the shop owner to /shop?tab=profile (Settings, where
// the SaaS Subscription card lives), so upgrade is one click away.

export default function FeatureUpgradePrompt({ title, body, requiredPlan = 'Pro Plan', hint }) {
  const navigate = useNavigate();
  return (
    <div style={{
      background: 'linear-gradient(135deg, #EEF2FF 0%, #F3E8FF 100%)',
      border: '1px solid #C7D2FE', borderRadius: 14, padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
      }}>
        <Sparkles size={20} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
          {title || `Upgrade to ${requiredPlan}`}
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
          {body || 'This feature is available on higher plans.'}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontStyle: 'italic' }}>{hint}</div>
        )}
      </div>
      <button
        onClick={() => navigate('/shop?tab=profile')}
        style={{
          background: '#4F46E5', color: '#fff', border: 'none',
          padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
          fontSize: 12, fontWeight: 700, display: 'inline-flex',
          alignItems: 'center', gap: 6, flexShrink: 0, width: 'auto',
        }}
      >
        Upgrade <ArrowRight size={14} />
      </button>
    </div>
  );
}

export function UpgradeChip({ requiredPlan = 'Pro', compact = false }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigate('/shop?tab=profile'); }}
      title={`Available on ${requiredPlan} Plan — click to upgrade`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: compact ? '2px 7px' : '3px 8px',
        borderRadius: 999, fontSize: compact ? 9 : 10, fontWeight: 700,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: '#fff',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(79,70,229,0.3)', width: 'auto',
      }}
    >
      <Lock size={compact ? 9 : 10} /> {requiredPlan}
    </button>
  );
}
