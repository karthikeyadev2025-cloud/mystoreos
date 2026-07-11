import { useNavigate } from 'react-router-dom';
import { T, F } from './_tokens';

// ─────────────────────────────────────────────────────────────────────
// THE SIGNATURE: a ledger spread.
//
// Two facing pages of one account book. Left page is a retail day —
// items, quantities, rates. Right page is a services day — times,
// services, staff. Both post into a single Day Total across the gutter.
//
// The artwork IS the argument: one book, two kinds of business. It
// replaces the usual hero template (big number, gradient glow, animated
// counter) with the actual object the product replaces.
//
// Rows post in on load, staggered, like someone writing up the day.
// prefers-reduced-motion kills it (handled in _tokens CSS).
// ─────────────────────────────────────────────────────────────────────

const RETAIL_ENTRIES = [
  { a: 'Toor dal 1kg',     b: '2', c: '68.00',  d: '136.00' },
  { a: 'Sunflower oil 1L', b: '1', c: '142.00', d: '142.00' },
  { a: 'Parle-G 200g',     b: '5', c: '30.00',  d: '150.00' },
  { a: 'Detergent 500g',   b: '1', c: '95.00',  d: '95.00'  },
];

const SERVICE_ENTRIES = [
  { a: 'Haircut',     b: '10:00', c: 'Ravi',  d: '300.00'  },
  { a: 'Hair colour', b: '11:30', c: 'Divya', d: '1800.00' },
  { a: 'Beard trim',  b: '13:00', c: 'Ravi',  d: '150.00'  },
  { a: 'Facial',      b: '16:00', c: 'Anita', d: '900.00'  },
];

const RETAIL_TOTAL  = '523.00';
const SERVICE_TOTAL = '3,150.00';
const DAY_TOTAL     = '3,673.00';

const GRID = '1fr 42px 60px 74px';

function LedgerPage({ heading, dot, cols, entries, total, totalLabel, side, startDelay }) {
  return (
    <div
      className={side === 'left' ? 'lx-page lx-page-left' : 'lx-page'}
      style={{
        padding: 'clamp(18px,2.4vw,26px)',
        borderRight: side === 'left' ? `1px solid ${T.rule}` : 'none',
        minWidth: 0,
      }}
    >
      {/* Which kind of business this page keeps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
        <span className="lx-eyebrow" style={{ color: T.ink, letterSpacing: '0.16em' }}>{heading}</span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 8,
        paddingBottom: 8, borderBottom: `1px solid ${T.ruleStrong}`,
      }}>
        {cols.map((c, i) => (
          <span key={c} className="lx-eyebrow" style={{
            fontSize: 9.5, letterSpacing: '0.12em',
            textAlign: i === 0 ? 'left' : i === cols.length - 1 ? 'right' : 'center',
          }}>{c}</span>
        ))}
      </div>

      {/* Entries — posted in one by one */}
      {entries.map((e, i) => (
        <div
          key={e.a}
          className="lx-post"
          style={{
            display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center',
            padding: '9px 0', borderBottom: `1px solid ${T.rule}`,
            animationDelay: `${startDelay + i * 90}ms`,
          }}
        >
          <span style={{
            fontFamily: F.body, fontSize: 13, color: T.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{e.a}</span>
          <span className="lx-fig" style={{ fontSize: 11.5, color: T.inkSoft, textAlign: 'center' }}>{e.b}</span>
          <span className="lx-fig" style={{ fontSize: 11.5, color: T.inkSoft, textAlign: 'center' }}>{e.c}</span>
          <span className="lx-fig" style={{ fontSize: 12.5, color: T.ink, textAlign: 'right', fontWeight: 500 }}>{e.d}</span>
        </div>
      ))}

      {/* Page subtotal */}
      <div
        className="lx-post"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          paddingTop: 11,
          animationDelay: `${startDelay + entries.length * 90 + 60}ms`,
        }}
      >
        <span className="lx-eyebrow" style={{ fontSize: 9.5 }}>{totalLabel}</span>
        <span className="lx-fig" style={{ fontSize: 15, fontWeight: 700, color: T.inkDeep }}>₹{total}</span>
      </div>
    </div>
  );
}

export default function LandingHero({ hero = {}, navigate: nav }) {
  const routerNavigate = useNavigate();
  const navigate = nav || routerNavigate;

  const headline = hero.headline || 'One book.\nTwo kinds of business.';
  const lines = headline.split('\n');

  return (
    <section id="hero" style={{
      background: T.paper,
      padding: 'clamp(72px,9vw,116px) clamp(20px,5vw,48px) clamp(56px,7vw,88px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* The margin rule — red vertical line of an account book, running
          the height of the section at a fixed inset. */}
      <div className="lx-margin-rule" style={{
        position: 'absolute', top: 0, bottom: 0, left: 'clamp(20px,5vw,48px)',
        width: 1, background: T.marginRed, opacity: 0.28, pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>

        {/* Eyebrow — reads like the header of a ledger page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
          <span className="lx-eyebrow" style={{ color: T.ink, fontWeight: 700 }}>MyStore&nbsp;OS</span>
          <span style={{ width: 22, height: 1, background: T.ruleStrong }} />
          <span className="lx-eyebrow">Billing &amp; Bookings</span>
        </div>

        {/* Headline */}
        <h1 className="lx-title" style={{
          fontSize: 'clamp(34px,6vw,66px)',
          maxWidth: '15ch',
          margin: '0 0 20px',
        }}>
          {lines.map((line, i) => (
            <span key={i} style={{
              display: 'block',
              color: i === lines.length - 1 ? T.inkSoft : T.inkDeep,
              fontWeight: i === lines.length - 1 ? 500 : 800,
            }}>{line}</span>
          ))}
        </h1>

        {/* Lede */}
        <p className="lx-lede" style={{ maxWidth: 520, margin: '0 0 32px', fontSize: 'clamp(15px,1.8vw,18px)' }}>
          {hero.subheadline || 'Sell products over a counter, or book appointments by the hour. MyStore OS keeps both — billing, stock, credit, scheduling, and the books — under one login.'}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="lx-btn lx-btn-primary" onClick={() => navigate('/register')}>
            Start free for 15 days
          </button>
          <button className="lx-btn lx-btn-ghost" onClick={() => navigate('/pricing')}>
            See pricing
          </button>
        </div>
        <p style={{
          margin: '0 0 44px', fontFamily: F.mono, fontSize: 11,
          color: T.inkFaint, letterSpacing: '0.03em',
        }}>
          No card needed · Every feature unlocked during the trial
        </p>

        {/* ── THE SPREAD ── */}
        <div style={{
          background: '#fff',
          border: `1px solid ${T.ruleStrong}`,
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(26,34,48,0.05), 0 12px 40px -18px rgba(26,34,48,0.18)',
          overflow: 'hidden',
        }}>
          {/* Date line across the top of the spread */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px clamp(18px,2.4vw,26px)',
            borderBottom: `1px solid ${T.ruleStrong}`,
            background: T.paperDeep,
          }}>
            <span className="lx-eyebrow" style={{ fontSize: 10 }}>Day book</span>
            <span className="lx-eyebrow lx-fig" style={{ fontSize: 10 }}>Today</span>
          </div>

          <div className="lx-spread">
            <LedgerPage
              side="left"
              heading="Retail"
              dot={T.marginRed}
              cols={['Item', 'Qty', 'Rate', 'Amount']}
              entries={RETAIL_ENTRIES}
              total={RETAIL_TOTAL}
              totalLabel="Counter sales"
              startDelay={220}
            />
            <LedgerPage
              side="right"
              heading="Services"
              dot={T.credit}
              cols={['Service', 'Time', 'Staff', 'Amount']}
              entries={SERVICE_ENTRIES}
              total={SERVICE_TOTAL}
              totalLabel="Appointments"
              startDelay={400}
            />
          </div>

          {/* Day total — spans the gutter. The point of the image: both
              kinds of business post into one set of books. */}
          <div
            className="lx-post"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '15px clamp(18px,2.4vw,26px)',
              borderTop: `2px solid ${T.inkDeep}`,
              background: T.paperDeep,
              animationDelay: '1020ms',
            }}
          >
            <span className="lx-eyebrow" style={{ color: T.inkDeep, fontWeight: 700 }}>Day total</span>
            <span className="lx-fig" style={{
              fontSize: 'clamp(19px,2.6vw,24px)', fontWeight: 700,
              color: T.inkDeep, letterSpacing: '-0.01em',
            }}>₹{DAY_TOTAL}</span>
          </div>
        </div>

        {/* Caption — names what you just looked at */}
        <p style={{
          marginTop: 14, fontFamily: F.body, fontSize: 12.5,
          color: T.inkFaint, lineHeight: 1.6,
        }}>
          A single day, kept both ways. Retail on the left, services on the right, one total at the bottom.
        </p>
      </div>

      <style>{`
        .lx-spread { display: grid; grid-template-columns: 1fr 1fr; }
        @media (max-width: 720px) {
          .lx-spread { grid-template-columns: 1fr; }
          .lx-page-left { border-right: 0 !important; border-bottom: 1px solid ${T.ruleStrong}; }
          .lx-margin-rule { display: none; }
        }
      `}</style>
    </section>
  );
}
