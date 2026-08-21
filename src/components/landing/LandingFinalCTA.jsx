import { useNavigate } from 'react-router-dom';
import { T, F } from './_tokens';

// The closing entry. Ink ground — the one place the page goes dark, so it
// reads as the bottom line of the book rather than another section.

export default function LandingFinalCTA({ navigate: nav }) {
  const routerNavigate = useNavigate();
  const navigate = nav || routerNavigate;

  return (
    <section style={{
      // The one dark band on a light page, and deliberately so: the
      // conversion moment gets the strongest value contrast available.
      // A uniformly light page has no rhythm and nothing to land on.
      background: 'var(--c-ink-surface)',
      padding: 'clamp(72px,9vw,112px) clamp(20px,5vw,48px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* The margin rule again, carried through to the last page */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 'clamp(20px,5vw,48px)',
        width: 1, background: 'transparent', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 780, margin: '0 auto', position: 'relative' }}>
        <span className="lx-eyebrow" style={{ color: T.brandBright }}>
          Closing balance
        </span>

        <h2 style={{
          fontFamily: F.display, fontWeight: 800,
          fontSize: 'clamp(30px,4.6vw,50px)', letterSpacing: '-0.03em',
          color: 'var(--c-surface)', lineHeight: 1.08, margin: '14px 0 0', maxWidth: '17ch',
        }}>
          Stop keeping the books by hand.
        </h2>

        <p style={{
          fontFamily: F.body, fontSize: 'clamp(15px,1.8vw,17px)',
          color: 'rgba(255,255,255,0.62)', lineHeight: 1.7,
          margin: '18px 0 32px', maxWidth: 480,
        }}>
          Fifteen days, every feature unlocked, no card. If it doesn&apos;t save you
          an hour a day, walk away — and take your data with you.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            className="lx-btn"
            onClick={() => navigate('/register')}
            style={{ background: 'var(--c-surface)', color: 'var(--c-ink)', fontWeight: 700 }}
          >
            Start free for 15 days
          </button>
          <button
            className="lx-btn"
            onClick={() => navigate('/login')}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.8)',
              borderColor: 'rgba(255,255,255,0.24)',
            }}
          >
            Sign in
          </button>
        </div>

        <p style={{
          fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.38)',
          letterSpacing: '0.03em', margin: 0,
        }}>
          Works offline · Export everything, any time · Cancel whenever
        </p>
      </div>
    </section>
  );
}
