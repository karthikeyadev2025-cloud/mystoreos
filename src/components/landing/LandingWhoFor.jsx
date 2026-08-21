import { T, F } from './_tokens';

// An index, not a card grid. The grouping carries the argument: the
// dividing line isn't "shop vs salon", it's whether you sell STOCK or
// sell TIME. That's the only distinction the software actually cares
// about, and naming it plainly does more work than nine glassy cards.

const SELL_STOCK = [
  ['Kirana & general store',  'Counter billing, khata, stock'],
  ['Medical & pharmacy',      'HSN, GST, batch & expiry'],
  ['Apparel & footwear',      'Variants, sizes, seasonal offers'],
  ['Electronics & hardware',  'Serial numbers, warranty, credit'],
  ['Restaurant & café',       'Fast counter billing, KOT, thermal'],
  ['Wholesale distribution',  'Bulk orders, routes, settlements'],
];

const SELL_TIME = [
  ['Salon & barber',          'Bookings, staff, reminders'],
  ['Spa & wellness',          'Slots, buffer time, therapists'],
  ['Clinic & dental',         'Patient slots, recurring follow-ups'],
  ['Gym & fitness',           'Trainer sessions, recurring weekly'],
  ['Tuition & coaching',      'Batches, recurring classes'],
  ['Repair & workshop',       'Job cards, parts plus labour'],
];

function Column({ title, note, rows, accent }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
        <h3 style={{
          fontFamily: F.display, fontSize: 19, fontWeight: 800,
          color: T.text, letterSpacing: '-0.015em', margin: 0,
        }}>{title}</h3>
      </div>
      <p style={{
        fontFamily: F.body, fontSize: 13, color: T.textFaint,
        margin: '0 0 18px', paddingLeft: 16,
      }}>{note}</p>

      <div style={{ borderTop: `1px solid ${T.edgeLift}` }}>
        {rows.map(([trade, detail], i) => (
          <div
            key={trade}
            className="lx-post"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              gap: 14, padding: '13px 0', borderBottom: `1px solid ${T.edge}`,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <span style={{
              fontFamily: F.body, fontSize: 14.5, fontWeight: 600, color: T.text,
            }}>{trade}</span>
            <span style={{
              fontFamily: F.mono, fontSize: 10.5, color: T.textFaint,
              textAlign: 'right', letterSpacing: '0.02em',
            }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingWhoFor() {
  return (
    <section id="who" style={{
      background: T.voidLift,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <span className="lx-eyebrow">Who it&apos;s for</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(27px,4vw,42px)', maxWidth: '20ch' }}>
          Some businesses sell stock. Some sell time.
        </h2>
        <p className="lx-lede" style={{ maxWidth: 560, marginBottom: 48 }}>
          That&apos;s the only line MyStore OS draws. Pick a side when you sign up
          and the software arranges itself around how you actually work.
        </p>

        <div className="lx-who-grid">
          <Column
            title="Sell stock"
            note="Products across a counter"
            rows={SELL_STOCK}
            accent={T.rose}
          />
          <Column
            title="Sell time"
            note="Appointments by the hour"
            rows={SELL_TIME}
            accent={T.green}
          />
        </div>

        <p style={{
          fontFamily: F.body, fontSize: 13.5, color: T.textSoft,
          marginTop: 34, paddingTop: 20, borderTop: `1px solid ${T.edge}`,
          lineHeight: 1.7,
        }}>
          Doing both? A salon that also sells hair products, a workshop that sells parts —
          turn on a product catalogue alongside your bookings and keep one set of books for the lot.
        </p>
      </div>

      <style>{`
        .lx-who-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(32px,5vw,64px);
        }
        @media (max-width: 720px) {
          .lx-who-grid { grid-template-columns: 1fr; gap: 44px; }
        }
      `}</style>
    </section>
  );
}
