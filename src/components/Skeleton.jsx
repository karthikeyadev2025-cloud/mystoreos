// Reusable skeleton primitives for loading states.
// All components use a dark-theme shimmer animation.

const shimmerStyle = `
@keyframes mystore-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const baseShimmer = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'mystore-shimmer 1.5s ease-in-out infinite',
  borderRadius: '8px',
};

export const SkeletonLine = ({ width = '100%', height = '14px', style }) => (
  <div style={{ ...baseShimmer, width, height, ...style }} />
);

export const SkeletonCircle = ({ size = '40px', style }) => (
  <div style={{ ...baseShimmer, width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }} />
);

export const SkeletonCard = ({ height = '120px', style }) => (
  <div style={{ ...baseShimmer, height, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', ...style }} />
);

// Full-page dashboard skeleton for Suspense fallback
export const DashboardSkeleton = () => (
  <div style={{
    minHeight: '100vh', background: 'var(--c-ink)', display: 'flex',
    fontFamily: 'var(--font-sans)',
  }}>
    <style>{shimmerStyle}</style>
    
    {/* Sidebar skeleton */}
    <div style={{
      width: '220px', padding: '24px 16px', background: 'rgba(255,255,255,0.02)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      flexShrink: 0,
    }}>
      <SkeletonLine width="120px" height="24px" style={{ marginBottom: '24px' }} />
      <SkeletonLine width="80px" height="12px" style={{ marginBottom: '16px' }} />
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
          <SkeletonCircle size="18px" />
          <SkeletonLine width="90px" height="14px" />
        </div>
      ))}
    </div>

    {/* Main content skeleton */}
    <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine width="200px" height="28px" />
        <div style={{ display: 'flex', gap: '12px' }}>
          <SkeletonLine width="100px" height="36px" style={{ borderRadius: '10px' }} />
          <SkeletonCircle size="36px" />
        </div>
      </div>

      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            ...baseShimmer, height: '90px', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.04)', padding: '16px',
          }}>
            <SkeletonLine width="60px" height="12px" style={{ marginBottom: '12px' }} />
            <SkeletonLine width="80px" height="24px" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Product grid */}
        <div style={{
          ...baseShimmer, minHeight: '400px', borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.04)', padding: '20px',
        }}>
          <SkeletonLine width="180px" height="18px" style={{ marginBottom: '20px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[1,2,3,4,5,6].map(i => (
              <SkeletonCard key={i} height="140px" />
            ))}
          </div>
        </div>

        {/* Cart skeleton */}
        <div style={{
          ...baseShimmer, minHeight: '400px', borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.04)', padding: '20px',
        }}>
          <SkeletonLine width="140px" height="18px" style={{ marginBottom: '20px' }} />
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <SkeletonCircle size="32px" />
              <div style={{ flex: 1 }}>
                <SkeletonLine width="100%" height="12px" style={{ marginBottom: '6px' }} />
                <SkeletonLine width="60px" height="10px" />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <SkeletonLine width="100%" height="42px" style={{ borderRadius: '10px' }} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Mobile skeleton (no sidebar)
export const MobileSkeleton = () => (
  <div style={{
    minHeight: '100vh', background: 'var(--c-ink)', padding: '16px',
    fontFamily: 'var(--font-sans)',
  }}>
    <style>{shimmerStyle}</style>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <SkeletonLine width="140px" height="24px" />
      <SkeletonCircle size="32px" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
      {[1,2,3,4].map(i => <SkeletonCard key={i} height="70px" />)}
    </div>
    <SkeletonCard height="200px" style={{ marginBottom: '16px' }} />
    <SkeletonCard height="160px" />
  </div>
);
