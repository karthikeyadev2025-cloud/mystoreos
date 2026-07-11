import { useState } from 'react';
import { T, F } from './_tokens';

// Native disclosure rows on a ruled list. No accordion library, no
// chevron that spins 180 degrees — a hairline plus/minus, because the
// point is to read the answer, not to admire the transition.

export default function LandingFAQ({ faq = [] }) {
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" style={{
      background: T.void,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <span className="lx-eyebrow">Questions</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(27px,4vw,42px)', marginBottom: 40 }}>
          Before you sign up.
        </h2>

        <div style={{ borderTop: `2px solid ${T.text}` }}>
          {faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${T.edge}` }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between', gap: 18,
                    background: 'none', border: 0, cursor: 'pointer',
                    padding: '18px 0', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: F.display, fontSize: 15.5, fontWeight: 600,
                    color: T.text, letterSpacing: '-0.01em', lineHeight: 1.45,
                  }}>{item.q}</span>
                  <span style={{
                    fontFamily: F.mono, fontSize: 15, color: T.textFaint,
                    flexShrink: 0, lineHeight: 1, width: 12, textAlign: 'center',
                  }}>{isOpen ? '–' : '+'}</span>
                </button>
                {isOpen && (
                  <p className="lx-post" style={{
                    fontFamily: F.body, fontSize: 14.5, color: T.textSoft,
                    lineHeight: 1.75, margin: '0 0 20px', paddingRight: 30, maxWidth: '62ch',
                  }}>{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
