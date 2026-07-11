import { useState } from 'react';
import { T, F } from './_tokens';

// A day, posted hour by hour. Two tracks — Retail and Services — because
// the same app produces two very different days, and a clinic owner
// scanning six screens of "reorder Parle-G" concludes it isn't for them
// regardless of what the feature list says.
//
// Times run down the left like a ledger's date column. The 24-hour clock
// is the structure here, and it's real information, so it earns the
// left rail.

const RETAIL_DAY = [
  ['08:00', 'Stock check',      'Low-stock alerts are waiting. Reorder from your distributor in one tap.'],
  ['10:30', 'Counter billing',  'Scan a barcode or type three letters. Bill done, receipt printed.'],
  ['13:00', 'Udhaar entry',     'Paying next week? Add it to the khata. The reminder sets itself.'],
  ['16:00', 'UPI collection',   'Send a payment link on WhatsApp. Confirmation lands back in the app.'],
  ['19:00', 'Sales review',     'Hourly chart, top lines, staff performance. All of it already added up.'],
  ['21:00', 'Day close',        'The day book totals itself. Share it with your accountant in a tap.'],
];

const SERVICES_DAY = [
  ['09:00', "Today's diary",    'Every appointment for the day, staff by staff, already laid out.'],
  ['09:15', 'Overnight bookings','Customers booked while you were closed. You were pinged the moment they did.'],
  ['11:00', 'Walk-in',          'Someone walks in. Log it, assign a staff member, done.'],
  ['14:00', 'Reminders go out', 'WhatsApp and SMS fire 24 hours and 1 hour ahead. Nobody forgets.'],
  ['17:00', 'Finish and bill',  'Mark the appointment complete and bill it in the same tap.'],
  ['20:00', 'Revenue review',   'Which services earn most, which staff are busiest. Already totalled.'],
];

const TRACKS = [
  { id: 'retail',   label: 'Retail',   day: RETAIL_DAY,   accent: T.rose },
  { id: 'services', label: 'Services', day: SERVICES_DAY, accent: T.green },
];

export default function LandingDayInLife() {
  const [track, setTrack] = useState('retail');
  const current = TRACKS.find(t => t.id === track) || TRACKS[0];

  return (
    <section style={{
      background: T.voidLift,
      borderTop: `1px solid ${T.edge}`,
      padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <span className="lx-eyebrow">A day, posted</span>
        <h2 className="lx-title" style={{ fontSize: 'clamp(27px,4vw,42px)', maxWidth: '16ch' }}>
          What the day actually looks like.
        </h2>
        <p className="lx-lede" style={{ maxWidth: 520, marginBottom: 36 }}>
          Same software, two very different days. Pick the one that looks like yours.
        </p>

        {/* Track tabs */}
        <div style={{
          display: 'flex', gap: 26, borderBottom: `1px solid ${T.edge}`, marginBottom: 30,
        }}>
          {TRACKS.map(t => (
            <button
              key={t.id}
              className="lx-tab"
              data-active={track === t.id}
              onClick={() => setTrack(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* The day */}
        <div>
          {current.day.map(([time, title, body], i) => (
            <div
              key={`${track}-${time}`}
              className="lx-post lx-day-row"
              style={{ animationDelay: `${i * 65}ms` }}
            >
              {/* Time rail — the ledger's date column */}
              <div style={{ position: 'relative', paddingTop: 2 }}>
                <span className="lx-fig" style={{
                  fontSize: 12, fontWeight: 500, color: T.text,
                }}>{time}</span>
              </div>

              {/* Tick — sits on the rule between the rail and the entry */}
              <div style={{ position: 'relative', height: '100%' }}>
                <span style={{
                  position: 'absolute', left: -3, top: 6,
                  width: 7, height: 7, borderRadius: '50%',
                  background: current.accent,
                }} />
                <span style={{
                  position: 'absolute', left: 0, top: 16, bottom: -18,
                  width: 1, background: T.edge,
                }} className="lx-day-line" />
              </div>

              <div style={{ minWidth: 0, paddingBottom: 4 }}>
                <div style={{
                  fontFamily: F.display, fontSize: 16, fontWeight: 700,
                  color: T.text, letterSpacing: '-0.01em',
                }}>{title}</div>
                <div style={{
                  fontFamily: F.body, fontSize: 14, color: T.textSoft,
                  lineHeight: 1.65, marginTop: 4,
                }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .lx-day-row {
          display: grid;
          grid-template-columns: 54px 12px 1fr;
          gap: 12px;
          padding: 0 0 26px;
          align-items: start;
        }
        .lx-day-row:last-child .lx-day-line { display: none; }
        @media (max-width: 560px) {
          .lx-day-row { grid-template-columns: 46px 12px 1fr; gap: 8px; }
        }
      `}</style>
    </section>
  );
}
