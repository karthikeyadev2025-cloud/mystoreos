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
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
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
              {/* Telugu quotes were rendering with broken glyph shaping.
                  Manrope has no Telugu coverage, and :lang(te) in tokens.css
                  only fires when the element declares its language — which
                  nothing here did, so the browser fell back to whatever the
                  OS happened to ship and shaped the syllables badly. Tagging
                  the element routes it to Noto Sans Telugu.
                  Telugu block: U+0C00–U+0C7F. */}
              <blockquote
                lang={/[\u0C00-\u0C7F]/.test(t.quote) ? 'te' : undefined}
                style={{
                margin: 0,
                // The :lang(te) rule in tokens.css cannot win here — an
                // inline style beats any stylesheet selector, and this app
                // styles nearly everything inline. So the font is chosen in
                // JS from the same test that sets the lang attribute.
                fontFamily: /[\u0C00-\u0C7F]/.test(t.quote) ? 'var(--font-telugu)' : F.body,
                fontSize: 15, lineHeight: 1.7,
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
