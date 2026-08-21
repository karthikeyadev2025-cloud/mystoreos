import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import MLogo from '../MLogo';
import { T, F } from './_tokens';

// The signature: the day book, lit.
//
// Two facing pages of one ledger — a retail day on the left, a services
// day on the right, both posting into a single Day Total across the
// gutter. The artwork IS the argument: one book, two kinds of business.
//
// Rendered as a premium artifact rather than a flat print: raised off the
// void, a warm gold glow under the total, rows posting in one by one.

const RETAIL_ROWS = [
  ['Toor dal 1kg',   '2', '136'],
  ['Sunflower oil', '1', '142'],
  ['Parle-G 200g',   '5', '150'],
  ['Soap bar',       '1', '95'],
];

const SERVICE_ROWS = [
  ['Haircut',     '10:00', '300'],
  ['Hair colour', '11:30', '1,800'],
  ['Beard trim',  '13:00', '150'],
  ['Facial',      '16:00', '900'],
];

function Page({ label, dot, cols, rows, subtotal, subtotalLabel, delay, divider }) {
  return (
    <div style={{
      padding: 'clamp(18px,2.2vw,24px)',
      borderRight: divider ? `1px solid ${T.edge}` : 'none',
      minWidth: 0,
    }} className={divider ? 'lx-ledger-page lx-ledger-left' : 'lx-ledger-page'}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="lx-pulse" style={{
          width: 7, height: 7, borderRadius: '50%', background: dot,
          boxShadow: `0 0 12px ${dot}`,
        }} />
        <span style={{
          fontFamily: F.mono, fontSize: 10.5, fontWeight: 500,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: T.text,
        }}>{label}</span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 52px 68px', gap: 10,
        paddingBottom: 9, borderBottom: `1px solid ${T.edge}`,
      }}>
        {cols.map((c, i) => (
          <span key={c} style={{
            fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: T.textGhost,
            textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center',
          }}>{c}</span>
        ))}
      </div>

      {rows.map(([name, mid, amt], i) => (
        <div key={name} className="lx-post" style={{
          display: 'grid', gridTemplateColumns: '1fr 52px 68px', gap: 10,
          alignItems: 'center', padding: '10px 0',
          borderBottom: `1px solid ${T.edge}`,
          animationDelay: `${delay + i * 100}ms`,
        }}>
          <span style={{
            fontFamily: F.body, fontSize: 13, color: T.textSoft,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</span>
          <span className="lx-fig" style={{ fontSize: 11, color: T.textFaint, textAlign: 'center' }}>{mid}</span>
          <span className="lx-fig" style={{ fontSize: 12.5, color: T.text, textAlign: 'right', fontWeight: 500 }}>{amt}</span>
        </div>
      ))}

      <div className="lx-post" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        paddingTop: 13, animationDelay: `${delay + rows.length * 100 + 80}ms`,
      }}>
        <span style={{
          fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.textGhost,
        }}>{subtotalLabel}</span>
        <span className="lx-fig" style={{ fontSize: 15, fontWeight: 700, color: T.text }}>₹{subtotal}</span>
      </div>
    </div>
  );
}

export default function LandingHero({ hero = {}, navigate: nav, config = {} }) {
  const routerNavigate = useNavigate();
  const navigate = nav || routerNavigate;

  const headline = hero.headline || 'One book.\nTwo kinds of business.';
  const lines = headline.split('\n');

  return (
    <section id="hero" style={{
      background: T.void,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px) clamp(72px,9vw,112px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient light — two pools bleeding through the void so the page
          has atmosphere instead of being a flat black rectangle. */}
      <div className="lx-glow lx-drift" style={{
        width: 620, height: 620, top: -180, left: '-8%',
        background: `radial-gradient(circle, ${T.brandGlow}, transparent 65%)`,
      }} />
      <div className="lx-glow lx-drift" style={{
        width: 480, height: 480, top: '30%', right: '-6%',
        background: `radial-gradient(circle, ${T.goldGlow}, transparent 65%)`,
        animationDelay: '-8s',
      }} />

      {/* Faint grid — graph paper under the ledger */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        // Ink on cream now, not white on black — a faint ruled grid, the
        // graph paper a ledger is drawn on.
        backgroundImage: `linear-gradient(rgba(11,31,51,0.035) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(11,31,51,0.035) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%)',
      }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* The brand lockup that used to sit here has been removed. The
            sticky nav carries the same logo and wordmark 40px above it,
            so this was the identical mark twice in one screenful — the
            second one occupying the most valuable space on the page,
            directly above the headline, and saying nothing new. The
            headline now starts higher and reads sooner. */}

        <div className="lx-hero-grid">
          {/* ── Left: the pitch ── */}
          <div style={{ minWidth: 0 }}>
            <span className="lx-chip lx-post" style={{ marginBottom: 22, color: T.brandBright, borderColor: T.edgeGlow, background: 'var(--c-primary-soft)' }}>
              <Zap size={11} /> 15-day free trial
            </span>

            <h1 className="lx-title" style={{
              fontSize: 'clamp(36px,5.4vw,60px)', margin: '0 0 20px', maxWidth: '16ch',
            }}>
              {lines.map((line, i) => (
                <span key={i} className="lx-post" style={{
                  display: 'block',
                  animationDelay: `${80 + i * 90}ms`,
                  // Was a navy-to-amber gradient text fill. Two problems on a
                  // light ground: the amber end sits at 1.92:1 on cream, so
                  // the tail of the phrase faded out; and gradient text is
                  // INVISIBLE to contrast checking — WebkitTextFillColor is
                  // transparent, so an automated audit reports it as passing
                  // while a reader cannot make out the last word.
                  // Solid display gold instead: emphatic, measurable, 3.62:1.
                  ...(i === lines.length - 1
                    ? { color: 'var(--c-accent-display)' }
                    : { color: T.text }),
                }}>{line}</span>
              ))}
            </h1>

            <p className="lx-lede lx-post" style={{
              maxWidth: 470, margin: '0 0 34px', animationDelay: '260ms',
            }}>
              {hero.subheadline || 'Sell products over a counter, or book appointments by the hour. MyStore OS keeps both — billing, stock, credit, scheduling, and the books — under one login.'}
            </p>

            <div className="lx-post" style={{
              display: 'flex', gap: 11, flexWrap: 'wrap', marginBottom: 20, animationDelay: '340ms',
            }}>
              <button className="lx-btn lx-btn-primary" onClick={() => navigate('/register')}>
                Start free <ArrowRight size={16} />
              </button>
              <button className="lx-btn lx-btn-ghost" onClick={() => navigate('/pricing')}>
                See pricing
              </button>
            </div>

            <p className="lx-post" style={{
              fontFamily: F.mono, fontSize: 11, color: T.textFaint,
              letterSpacing: '0.04em', margin: 0, animationDelay: '400ms',
            }}>
              No card needed · Every feature unlocked
            </p>
          </div>

          {/* ── Right: THE ARTIFACT ── */}
          <div style={{ minWidth: 0, position: 'relative' }}>
            {/* Glow beneath the book */}
            <div style={{
              position: 'absolute', inset: '12% 6% -4% 6%',
              background: `radial-gradient(ellipse at 50% 60%, ${T.brandGlow}, transparent 70%)`,
              filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0,
            }} />

            <div className="lx-surface lx-post" style={{
              position: 'relative', zIndex: 1, overflow: 'hidden',
              animationDelay: '200ms', borderRadius: 18,
            }}>
              {/* Book header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px clamp(18px,2.2vw,24px)',
                borderBottom: `1px solid ${T.edge}`,
                background: 'var(--c-surface-2)',
              }}>
                <span style={{
                  fontFamily: F.mono, fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: T.textSoft, fontWeight: 500,
                }}>Day book</span>
                <span className="lx-fig" style={{ fontSize: 10, color: T.textGhost, letterSpacing: '0.08em' }}>TODAY</span>
              </div>

              <div className="lx-ledger-spread">
                <Page
                  label="Retail" dot={T.rose} divider
                  cols={['Item', 'Qty', 'Amount']}
                  rows={RETAIL_ROWS}
                  subtotal="523" subtotalLabel="Counter"
                  delay={340}
                />
                <Page
                  label="Services" dot={T.green}
                  cols={['Service', 'Time', 'Amount']}
                  rows={SERVICE_ROWS}
                  subtotal="3,150" subtotalLabel="Bookings"
                  delay={520}
                />
              </div>

              {/* Day total — the gold line. Both kinds of business post
                  into one set of books; this is that sentence, in figures. */}
              <div className="lx-post" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '17px clamp(18px,2.2vw,24px)',
                borderTop: `1px solid ${T.edgeLift}`,
                background: `linear-gradient(180deg, var(--c-accent-soft), transparent)`,
                animationDelay: '1120ms',
              }}>
                <span style={{
                  fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase', color: T.goldText,
                }}>Day total</span>
                <span className="lx-fig" style={{
                  fontSize: 'clamp(21px,2.6vw,27px)', fontWeight: 700,
                  color: T.goldText, letterSpacing: '-0.02em',
                  textShadow: `0 0 28px ${T.goldGlow}`,
                }}>₹3,673</span>
              </div>
            </div>

            <p style={{
              marginTop: 16, fontFamily: F.body, fontSize: 12.5,
              color: T.textFaint, lineHeight: 1.6, textAlign: 'center',
            }}>
              One day, kept both ways. Retail left, services right, one total at the bottom.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .lx-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: clamp(36px,5vw,72px);
          align-items: center;
        }
        .lx-ledger-spread { display: grid; grid-template-columns: 1fr 1fr; }
        @media (max-width: 940px) {
          .lx-hero-grid { grid-template-columns: 1fr; gap: 48px; }
        }
        @media (max-width: 560px) {
          .lx-ledger-spread { grid-template-columns: 1fr; }
          .lx-ledger-left { border-right: 0 !important; border-bottom: 1px solid ${T.edge}; }
        }
      `}</style>
    </section>
  );
}
