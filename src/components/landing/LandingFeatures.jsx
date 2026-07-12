import { useState, useEffect } from 'react';
import {
  Store, Printer, Bell, BarChart3, Building2, WifiOff,
  ReceiptIndianRupee, PackageSearch, BookUser, Truck, Gift, FileSpreadsheet,
  CalendarCheck, UsersRound, MessageSquareDot, Link2, Timer, Repeat,
  Home, Mic, ShieldCheck,
} from 'lucide-react';
import { T, F } from './_tokens';
import { api } from '../../lib/api';

// Naming matches the product's own vocabulary — a shop is `businessKind:
// 'retail'`, a clinic is `businessKind: 'service'`. No cute personas, no
// emoji. "Services" covers salon, spa, clinic, gym, dental, workshop —
// every business that sells time rather than stock.
//
// Presented as ledger entries, not cards: a numbered index, the feature,
// and the plan it's included from. The plan column is the honest bit —
// hiding gating until after signup is how you earn a week-two refund.

const EVERY = [
  ['Storefront & marketplace', 'Your own public page. Customers find you, order, or book.',              'All plans',  Store,      '#818CF8'],
  ['Thermal & A4 printing',    '58mm and 80mm thermal receipts, plus standard A4 invoices.',            'All plans',  Printer,    '#34D399'],
  ['Instant alerts',           'New order or booking pings your phone — even with the app closed.',     'All plans',  Bell,       '#F5B942'],
  ['Live analytics',           'Revenue, top lines, staff performance. One dashboard, always current.', 'All plans',  BarChart3,  '#22D3EE'],
  ['Works offline',            'Keep billing without internet. Syncs the moment you reconnect.',        'All plans',  WifiOff,    '#FB7185'],
  ['Multi-branch',             'Several outlets, one login. Each keeps its own books.',                 'Enterprise', Building2,  '#A78BFA'],
];

const RETAIL = [
  ['GST invoicing',         'GSTIN-compliant bills in seconds. GSTR-1 and GSTR-3B export built in.',     'Enterprise', ReceiptIndianRupee, '#818CF8'],
  ['Stock & expiry',        'Reorder points, batch numbers, and expiry warnings before you eat a loss.', 'Pro',        PackageSearch,      '#FB7185'],
  ['Udhaar ledger',         'Customer balances live. Automatic WhatsApp reminders. Supplier book too.',  'All plans',  BookUser,           '#F5B942'],
  ['Distributor orders',    'Connect to FMCG distributors. Place stock orders, track deliveries.',       'All plans',  Truck,              '#34D399'],
  ['Loyalty & flash sales', 'Reward regulars automatically. Run time-boxed offers on your storefront.',  'Pro',        Gift,               '#F472B6'],
  ['CA portal & Tally',     'Give your accountant direct access. One-click Tally export.',               'Enterprise', FileSpreadsheet,    '#22D3EE'],
  ['Voice billing',         'Say "two Parle-G" and it\u2019s on the bill. No typing, both hands free at the counter.', 'All plans', Mic, '#A78BFA'],
];

const SERVICES = (addonPrice) => [
  ['Online booking',       'Customers book from your public page. Double-booking blocked automatically.', 'Pro',        CalendarCheck,     '#34D399'],
  ['Staff scheduling',     'Assign services to specific staff. Per-person hours and time off.',           'Pro',        UsersRound,        '#818CF8'],
  ['Automatic reminders',  'WhatsApp and SMS, 24 hours and 1 hour before. No-shows drop sharply.',        'Pro',        MessageSquareDot,  '#F5B942'],
  ['Self-service changes', 'Customers reschedule or cancel by link. No phone calls.',                     'Pro',        Link2,             '#22D3EE'],
  ['Buffer time',          'Reserve cleanup and prep time after each appointment.',                       'Pro',        Timer,             '#FB7185'],
  ['Recurring bookings',   'Hold the same slot weekly or monthly. Clashes skipped automatically.',        'Enterprise', Repeat,            '#A78BFA'],
  ['Home service visits',  'Customers book at their own address. Built for salons, spas, beauty, repairs.', `Add-on ₹${addonPrice}/mo`, Home, '#FB7185'],
  ['Staff safety check-in','Exact visit location, on-the-way/arrived check-in, and a one-tap emergency alert for staff working alone at a home visit.', `Add-on ₹${addonPrice}/mo`, ShieldCheck, '#EF4444'],
];

const PLAN_TONE = {
  'All plans':  { fg: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  'Pro':        { fg: '#818CF8', bg: 'rgba(129,140,248,0.14)' },
  'Enterprise': { fg: '#F5B942', bg: 'rgba(245,185,66,0.13)' },
};
// Add-on badges carry a live price ("Add-on ₹199/mo") rather than a
// fixed tier name, so they can't be exact-matched against PLAN_TONE's
// keys — detected by prefix instead. Distinct rose tone: not included
// in any plan, purchased separately, worth standing out from the
// green/indigo/gold tier colours.
const toneFor = (plan) => plan.startsWith('Add-on') ? { fg: '#FB7185', bg: 'rgba(251,113,133,0.13)' } : (PLAN_TONE[plan] || PLAN_TONE['All plans']);

export default function LandingFeatures() {
  const [tab, setTab] = useState('every');
  // Live price for the two home-service add-on rows below — read from
  // the same admin-configurable value (Admin > Settings > Pricing) the
  // actual purchase flow charges, so this marketing copy can never
  // silently drift from what a shop is really charged.
  const [addonPrice, setAddonPrice] = useState(199);
  useEffect(() => {
    api.getPricing().then(p => {
      const price = Number(p?.addons?.homeService);
      if (price > 0) setAddonPrice(price);
    }).catch(() => {}); // keep the 199 fallback if this fails
  }, []);

  const TABS = [
    { id: 'every',    label: 'Every business', rows: EVERY,
      note: 'The core platform. Everything below is included whatever you sell.' },
    { id: 'retail',   label: 'Retail',         rows: RETAIL,
      note: 'Kirana, medical, electronics, apparel, hardware — anything sold over a counter.' },
    { id: 'services', label: 'Services',       rows: SERVICES(addonPrice),
      note: 'Salon, spa, clinic, gym, dental, workshop — anything booked by the hour.' },
  ];
  const active = TABS.find(t => t.id === tab) || TABS[0];

  return (
    <section id="features" style={{
      background: T.void,
      borderTop: `1px solid ${T.edge}`,
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
          display: 'flex', gap: 26, borderBottom: `1px solid ${T.edge}`, marginBottom: 4,
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
          fontFamily: F.body, fontSize: 13, color: T.textFaint,
          margin: '16px 0 8px', minHeight: 20,
        }}>
          {active.note}
        </p>

        {/* Lit cards. Each one is a raised surface with a coloured icon
            well — the colour is what stops six rows of text reading as a
            spreadsheet. */}
        <div className="lx-feat-grid">
          {active.rows.map(([name, desc, plan, Icon, accent], i) => {
            const tone = toneFor(plan);
            return (
              <div
                key={name}
                className="lx-post lx-surface lx-surface-hover"
                style={{ padding: 22, animationDelay: `${i * 60}ms` }}
              >
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 12, marginBottom: 16,
                }}>
                  {/* Icon well — lit from within with the feature's accent */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 11,
                    background: `linear-gradient(145deg, ${accent}26, ${accent}0D)`,
                    border: `1px solid ${accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 0 24px -6px ${accent}59, inset 0 1px 0 ${accent}33`,
                  }}>
                    <Icon size={19} color={accent} strokeWidth={1.9} />
                  </div>

                  <span style={{
                    fontFamily: F.mono, fontSize: 9.5, fontWeight: 500,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: tone.fg, background: tone.bg,
                    border: `1px solid ${tone.fg}33`,
                    padding: '4px 9px', borderRadius: 999,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{plan}</span>
                </div>

                <div style={{
                  fontFamily: F.display, fontSize: 16.5, fontWeight: 700,
                  color: T.text, letterSpacing: '-0.015em', marginBottom: 7,
                }}>{name}</div>
                <div style={{
                  fontFamily: F.body, fontSize: 13.5, color: T.textSoft,
                  lineHeight: 1.65,
                }}>{desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .lx-feat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr));
          gap: 16px;
          margin-top: 4px;
        }
      `}</style>
    </section>
  );
}
