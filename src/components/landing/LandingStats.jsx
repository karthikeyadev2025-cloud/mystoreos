export default function LandingStats({ stats = {} }) {
  const data = [
    { val: `${stats.shops || 12847}+`, label: 'Merchant Outlets', sub: 'Across India' },
    { val: `${(stats.orders || 240000) >= 100000 ? ((stats.orders||240000)/100000).toFixed(1)+'L' : (stats.orders||240000).toLocaleString()}+`, label: 'Daily Invoices', sub: 'Generated every day' },
    { val: '₹842Cr+', label: 'GMV Processed', sub: 'This fiscal year' },
    { val: `${stats.cities || 28}+`, label: 'States & UTs', sub: 'Pan-India coverage' },
    { val: '99.97%', label: 'Platform Uptime', sub: 'Enterprise SLA' },
  ];

  return (
    <section style={{
      background: '#1E293B',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <div className="stats-grid" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {data.map(({ val, label, sub }, i) => (
          <div key={i} className={`stats-cell stats-cell-${i}`} style={{
            padding: 'clamp(20px,3vw,32px) clamp(12px,2vw,24px)', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono','Courier New',monospace",
              fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1,
            }}>{val}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{label}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11.5 }}>{sub}</div>
          </div>
        ))}
      </div>
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
        }
        .stats-cell { border-right: 1px solid rgba(255,255,255,0.07); }
        .stats-cell:last-child { border-right: none; }
        @media(max-width:700px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .stats-cell { border-bottom: 1px solid rgba(255,255,255,0.07); }
          .stats-cell-1, .stats-cell-3 { border-right: none !important; }
          .stats-cell-4 { grid-column: span 2; border-right: none !important; }
        }
        @media(max-width:380px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
