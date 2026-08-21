import { T, F } from './_tokens';

// Presented as a trial balance: label left, figure right, ruled between.
// No animated count-ups — a ledger doesn't perform, it states.

export default function LandingStats({ stats = {} }) {
  const ROWS = [
    ['Businesses on the platform', `${(stats.shops   ?? 500).toLocaleString('en-IN')}+`],
    ['Bills and bookings posted',  `${(stats.orders  ?? 50000).toLocaleString('en-IN')}+`],
    ['Towns and cities',           `${(stats.cities  ?? 200).toLocaleString('en-IN')}+`],
    ['Uptime, last 12 months',     `${stats.uptime   ?? 99.9}%`],
  ];

  return (
    <section style={{
      background: T.voidLift,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <span className="lx-eyebrow" style={{ display: 'block', marginBottom: 22 }}>
          On the books
        </span>

        <div style={{ borderTop: `2px solid ${T.text}` }}>
          {ROWS.map(([label, figure], i) => (
            <div
              key={label}
              className="lx-post"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                gap: 16, padding: '15px 0',
                borderBottom: `1px solid ${T.edge}`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <span style={{ fontFamily: F.body, fontSize: 14.5, color: T.text }}>{label}</span>
              <span className="lx-fig" style={{
                fontSize: 'clamp(17px,2.2vw,21px)', fontWeight: 700, color: T.text,
                letterSpacing: '-0.01em',
              }}>{figure}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
