import { T, F } from './_tokens';

// No badge soup, no logo wall of companies that don't exist. Four plain
// statements about how the thing is actually built and run. If a claim
// can't be defended, it isn't here.

const POINTS = [
  ['Your data is yours',
   'Exported any time, in full, as CSV. No lock-in, no export fee, no notice period.'],
  ['Encrypted end to end',
   'Every connection is TLS. Records are encrypted at rest and isolated per business.'],
  ['Payments handled by Razorpay',
   'Card and UPI details never touch our servers. We never see them.'],
  ['Backed up continuously',
   'Point-in-time recovery. A bad afternoon does not become a lost year of books.'],
];

export default function LandingTrust() {
  return (
    <section style={{
      background: T.voidLift,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <span className="lx-eyebrow">Trust</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(25px,3.6vw,38px)', maxWidth: '20ch', marginBottom: 42 }}>
          Your books, kept properly.
        </h2>

        <div className="lx-trust-grid">
          {POINTS.map(([title, body], i) => (
            <div
              key={title}
              className="lx-post"
              style={{
                paddingTop: 18, borderTop: `1px solid ${T.edgeLift}`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{
                fontFamily: F.display, fontSize: 16, fontWeight: 700,
                color: T.text, letterSpacing: '-0.01em', marginBottom: 7,
              }}>{title}</div>
              <div style={{
                fontFamily: F.body, fontSize: 13.5, color: T.textSoft, lineHeight: 1.7,
              }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .lx-trust-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: clamp(24px,3.5vw,44px);
        }
        @media (max-width: 640px) {
          .lx-trust-grid { grid-template-columns: 1fr; gap: 26px; }
        }
      `}</style>
    </section>
  );
}
