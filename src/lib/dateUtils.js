// Local-calendar-day date helpers.
//
// Bug this fixes: Date.toISOString() always returns the date in UTC, not
// the shop owner's local timezone. India is UTC+5:30 — for any sale made
// between midnight and 5:30 AM IST, toISOString().slice(0,10) returns
// YESTERDAY's date, not today's. Every "Today's Sales" / Day Book filter
// and the 30-day revenue chart that compared against this string was
// silently misattributing roughly 5.5 hours of every night's real sales
// to the wrong calendar day.
//
// localDateStr() uses the 'en-CA' locale, which conveniently formats as
// YYYY-MM-DD — giving the same shape as toISOString().slice(0,10) but
// computed in the browser's actual local timezone instead of UTC.

export function localDateStr(date = new Date()) {
  return date.toLocaleDateString('en-CA'); // en-CA => YYYY-MM-DD, local TZ
}

// Builds an array of the last N local calendar-day strings, oldest first —
// e.g. last30Days() => ['2026-05-21', '2026-05-22', ..., today].
export function lastNLocalDays(n = 30) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (n - 1) + i);
    return localDateStr(d);
  });
}
