import { useState } from 'react';
import { T, F } from './_tokens';

// Naming matches the product's own vocabulary — a shop is `businessKind:
// 'retail'`, a clinic is `businessKind: 'service'`. No cute personas, no
// emoji. "Services" covers salon, spa, clinic, gym, dental, workshop —
// every business that sells time rather than stock.
//
// Presented as ledger entries, not cards: a numbered index, the feature,
// and the plan it's included from. The plan column is the honest bit —
// hiding gating until after signup is how you earn a week-two refund.

const EVERY = [
  ['Storefront & marketplace',   'Your own public page. Customers find you, order, or book.',              'All plans'],
  ['Thermal & A4 printing',       '58mm and 80mm thermal receipts, plus standard A4 invoices.',            'All plans'],
  ['Instant alerts',              'New order or booking pings your phone — even with the app closed.',     'All plans'],
  ['Live analytics',              'Revenue, top lines, staff performance. One dashboard, always current.', 'All plans'],
  ['Works offline',               'Keep billing without internet. Syncs the moment you reconnect.',        'All plans'],
  ['Multi-branch',                'Several outlets, one login. Each keeps its own books.',                 'Enterprise'],
];

const RETAIL = [
  ['GST invoicing',        'GSTIN-compliant bills in seconds. GSTR-1 and GSTR-3B export built in.',  'Enterprise'],
  ['Stock & expiry',       'Reorder points, batch numbers, and expiry warnings before you eat a loss.', 'Pro'],
  ['Udhaar ledger',        'Customer balances live. Automatic WhatsApp reminders. Supplier book too.',  'All plans'],
  ['Distributor orders',   'Connect to FMCG distributors. Place stock orders, track deliveries.',       'All plans'],
  ['Loyalty & flash sales','Reward regulars automatically. Run time-boxed offers on your storefront.',   'Pro'],
  ['CA portal & Tally',    'Give your accountant direct access. One-click Tally export.',               'Enterprise'],
];

const SERVICES = [
  ['Online booking',       'Customers book from your public page. Double-booking blocked automatically.', 'Pro'],
  ['Staff scheduling',     'Assign services to specific staff. Per-person hours and time off.',           'Pro'],
  ['Automatic reminders',  'WhatsApp and SMS, 24 hours and 1 hour before. No-shows drop sharply.',        'Pro'],
  ['Self-service changes', 'Customers reschedule or cancel by link. No phone calls.',                     'Pro'],
  ['Buffer time',          'Reserve cleanup and prep time after each appointment.',                       'Pro'],
  ['Recurring bookings',   'Hold the same slot weekly or monthly. Clashes skipped automatically.',        'Enterprise'],
];

const TABS = [
  { id: 'every',    label: 'Every business', rows: EVERY,
    note: 'The core platform. Everything below is included whatever you sell.' },
  { id: 'retail',   label: 'Retail',         rows: RETAIL,
    note: 'Kirana, medical, electronics, apparel, hardware — anything sold over a counter.' },
  { id: 'services', label: 'Services',       rows: SERVICES,
    note: 'Salon, spa, clinic, gym, dental, workshop — anything booked by the hour.' },
];

const PLAN_TONE = {
  'All plans':  { fg: T.credit,    bg: T.creditSoft },
  'Pro':        { fg: T.brand,     bg: T.brandSoft },
  'Enterprise': { fg: T.marginRed, bg: T.marginRedSoft },
};

export default function LandingFeatures() {
  const [tab, setTab] = useState('every');
  const active = TABS.find(t => t.id === tab) || TABS[0];

  return (
    <section id="features" style={{
      background: '#fff',
      borderTop: `1px solid ${T.rule}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <span className="lx-eyebrow">What you get</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(27px,4vw,42px)', maxWidth: '18ch' }}>
          One platform. Two kinds of business.
        </h2>
        <p className="lx-lede" style={{ maxWidth: 540, marginBottom: 40 }}>
          Whether you sell stock or sell time, it&apos;s the same login and the same books.
          Pick your side to see what&apos;s included.
        </p>

        {/* Tabs — ledger column tabs, not pills */}
        <div style={{
          display: 'flex', gap: 26, borderBottom: `1px solid ${T.rule}`, marginBottom: 4,
          flexWrap: 'wrap',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className="lx-tab"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p style={{
          fontFamily: F.body, fontSize: 13, color: T.inkFaint,
          margin: '16px 0 8px', minHeight: 20,
        }}>
          {active.note}
        </p>

        {/* The rows */}
        <div>
          {active.rows.map(([name, desc, plan], i) => {
            const tone = PLAN_TONE[plan] || PLAN_TONE['All plans'];
            return (
              <div
                key={name}
                className="lx-post lx-feat-row"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                {/* Index — a ledger line number. Real sequence, so it earns
                    its place; these are entries in a list, not decoration. */}
                <span className="lx-fig" style={{
                  fontSize: 11, color: T.inkFaint, paddingTop: 3,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: F.display, fontSize: 16, fontWeight: 700,
                    color: T.inkDeep, letterSpacing: '-0.01em',
                  }}>{name}</div>
                  <div style={{
                    fontFamily: F.body, fontSize: 13.5, color: T.inkSoft,
                    lineHeight: 1.6, marginTop: 3,
                  }}>{desc}</div>
                </div>

                {/* Plan column — right-aligned, like an amount */}
                <span style={{
                  fontFamily: F.mono, fontSize: 10, fontWeight: 500,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: tone.fg, background: tone.bg,
                  padding: '4px 9px', borderRadius: 3,
                  whiteSpace: 'nowrap', justifySelf: 'end', alignSelf: 'start',
                  marginTop: 2,
                }}>{plan}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .lx-feat-row {
          display: grid;
          grid-template-columns: 30px 1fr 96px;
          gap: 14px;
          align-items: start;
          padding: 17px 0;
          border-bottom: 1px solid ${T.rule};
        }
        @media (max-width: 600px) {
          .lx-feat-row {
            grid-template-columns: 24px 1fr;
            grid-template-areas: 'num body' '.   plan';
            row-gap: 8px;
          }
          .lx-feat-row > span:first-child { grid-area: num; }
          .lx-feat-row > div              { grid-area: body; }
          .lx-feat-row > span:last-child  { grid-area: plan; justify-self: start !important; }
        }
      `}</style>
    </section>
  );
}
