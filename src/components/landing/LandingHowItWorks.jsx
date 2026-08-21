import { useNavigate } from 'react-router-dom';
import { T, F } from './_tokens';

// Numbered, because this genuinely is a sequence — you cannot bill before
// you've told it what you sell. Order carries information the reader
// needs, which is the only thing that earns a numbered marker.

const STEPS = [
  ['Sign up',
   'Phone number and a password. Tell it whether you sell stock or sell time — that one answer arranges the whole dashboard.'],
  ['Load what you sell',
   'Products or services, typed in or bulk-imported from a spreadsheet. Ten minutes for most businesses.'],
  ['Start billing',
   'Ring up a sale or take a booking. Everything after that — stock, khata, reminders, the books — keeps itself.'],
];

export default function LandingHowItWorks({ navigate: nav }) {
  const routerNavigate = useNavigate();
  const navigate = nav || routerNavigate;

  return (
    <section style={{
      background: T.void,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <span className="lx-eyebrow">Getting started</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(27px,4vw,42px)', maxWidth: '16ch', marginBottom: 44 }}>
          Open the book, start posting.
        </h2>

        <div style={{ maxWidth: 800 }}>
        {STEPS.map(([title, body], i) => (
          <div
            key={title}
            className="lx-post lx-step"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="lx-fig" style={{
              fontSize: 'clamp(26px,3.4vw,34px)', fontWeight: 700,
              // Was T.edge — the hairline colour — set at 34px. A rule and a
              // numeral are not the same job; it measured 1.37:1.
              color: T.textFaint, lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: F.display, fontSize: 18, fontWeight: 700,
                color: T.text, letterSpacing: '-0.015em', marginBottom: 6,
              }}>{title}</div>
              <div style={{
                fontFamily: F.body, fontSize: 14.5, color: T.textSoft, lineHeight: 1.7,
              }}>{body}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 38, paddingTop: 26, borderTop: `1px solid ${T.edge}` }}>
          <button className="lx-btn lx-btn-primary" onClick={() => navigate('/register')}>
            Start free for 15 days
          </button>
        </div>
        </div>
      </div>

      <style>{`
        .lx-step {
          display: grid;
          grid-template-columns: 62px 1fr;
          gap: 18px;
          align-items: start;
          padding: 22px 0;
          border-top: 1px solid ${T.edge};
        }
        .lx-step:first-of-type { border-top: 2px solid ${T.text}; }
        @media (max-width: 560px) {
          .lx-step { grid-template-columns: 46px 1fr; gap: 12px; }
        }
      `}</style>
    </section>
  );
}
