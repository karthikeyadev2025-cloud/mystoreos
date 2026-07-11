import { T, F } from './_tokens';

// Marginalia — notes written in the margin of the book. No five-star
// rows (nobody believes a wall of five stars), no round avatars, no
// carousel. Just the words, the name, and the trade, ruled apart.

export default function LandingTestimonials({ testimonials = [] }) {
  const rows = testimonials.slice(0, 6);
  if (!rows.length) return null;

  return (
    <section style={{
      background: T.void,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <span className="lx-eyebrow">In the margin</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(25px,3.6vw,38px)', marginBottom: 44 }}>
          What people actually say.
        </h2>

        <div className="lx-quotes">
          {rows.map((t, i) => (
            <figure
              key={`${t.name}-${i}`}
              className="lx-post"
              style={{
                margin: 0, paddingTop: 18,
                borderTop: `1px solid ${T.edgeLift}`,
                animationDelay: `${i * 55}ms`,
              }}
            >
              <blockquote style={{
                margin: 0,
                fontFamily: F.body, fontSize: 15, lineHeight: 1.7,
                color: T.text,
              }}>
                {t.quote}
              </blockquote>
              <figcaption style={{
                marginTop: 12, display: 'flex', alignItems: 'baseline',
                gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: T.text,
                }}>{t.name}</span>
                <span style={{
                  fontFamily: F.mono, fontSize: 10.5, color: T.textFaint,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>{t.city}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <style>{`
        .lx-quotes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(24px,3vw,40px);
        }
        @media (max-width: 900px) { .lx-quotes { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .lx-quotes { grid-template-columns: 1fr; gap: 26px; } }
      `}</style>
    </section>
  );
}
