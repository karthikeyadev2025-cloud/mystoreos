import { useNavigate } from 'react-router-dom';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';

// Shared shell for document-style pages (Privacy, Terms). Takes the
// SECTIONS content array each page already defines — { icon, title,
// content() } — and renders it as ruled ledger entries instead of the
// old glass-card stack. Preserves every word of the legal text; only
// the presentation changes.
//
// A doc page reads like the reference pages at the back of a real
// ledger book: numbered clauses, quiet, no colour except the chip
// that names what kind of document this is.

export default function LegalDoc({ eyebrow, title, updated, sections, accent = T.brandBright }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      {/* Header — same eyebrow/title pattern as every landing section */}
      <header style={{
        background: T.voidLift,
        borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,48px) clamp(40px,5vw,56px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span className="lx-eyebrow" style={{ color: accent }}>{eyebrow}</span>
          <h1 className="lx-title" style={{ fontSize: 'clamp(30px,4.6vw,48px)', margin: '14px 0 10px' }}>
            {title}
          </h1>
          <p style={{ fontFamily: F.mono, fontSize: 12, color: T.textFaint, margin: 0 }}>
            {updated} · K² ADEXOS GLOBAL TECHNOLOGIES
          </p>
        </div>
      </header>

      {/* Body — numbered ruled sections */}
      <main style={{ padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px) clamp(64px,8vw,96px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {sections.map((sec, i) => (
            <section
              key={sec.title}
              className="lx-post"
              style={{
                padding: '28px 0',
                borderTop: i === 0 ? `2px solid ${T.text}` : `1px solid ${T.edge}`,
                animationDelay: `${Math.min(i, 8) * 45}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
                <span className="lx-fig" style={{
                  fontSize: 13, color: T.textGhost, flexShrink: 0, minWidth: 22,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 style={{
                  fontFamily: F.display, fontSize: 19, fontWeight: 700,
                  color: T.text, letterSpacing: '-0.015em', margin: 0,
                }}>
                  {sec.title}
                </h2>
              </div>
              <div style={{ paddingLeft: 36, fontFamily: F.body, fontSize: 14.5, color: T.textSoft, lineHeight: 1.8 }}>
                {typeof sec.content === 'function' ? sec.content() : sec.content}
              </div>
            </section>
          ))}
        </div>
      </main>

      <LandingFooter navigate={navigate} />
    </div>
  );
}

// Style helpers a SECTIONS content() function can import instead of
// redefining its own inline S object. Kept minimal — most legal copy
// only needs a paragraph, a list, and an occasional emphasis span.
export const docStyles = {
  p: { color: T.textSoft, lineHeight: 1.8, fontSize: 14.5, margin: '0 0 12px' },
  ul: { color: T.textSoft, lineHeight: 1.8, fontSize: 14.5, paddingLeft: 20, margin: '0 0 12px' },
  strong: { color: T.text, fontWeight: 600 },
  highlight: { color: T.green, fontWeight: 600 },
  warn: { color: T.gold, fontWeight: 600 },
};
