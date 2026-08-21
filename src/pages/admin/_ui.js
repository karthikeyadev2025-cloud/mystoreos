// Shared enterprise design system for the admin panel.
//
// All admin tabs (TabOverview, TabShops, TabRevenue, …) import from
// here so the panel reads as ONE consistent product rather than 13
// visually-drifting screens. Also fixes mobile: every primitive here
// is responsive by default (min-width media queries, wrap layouts,
// touch-sized tap targets on <=1023px viewports).
//
// If you're building a NEW admin tab, use these primitives and skip
// re-defining a local `S = { card: {...}, ... }` object. If you need a
// visual not covered here, add it here first so other tabs benefit.

// ── DESIGN TOKENS ───────────────────────────────────────────────────
export const T = {
  // Neutrals
  bg:         'var(--c-line-soft)',
  cardBg:     'var(--c-surface)',
  cardBorder: 'var(--c-line)',
  divider:    'var(--c-line-soft)',
  // Ink scale
  ink:        'var(--c-ink)',
  inkMuted:   'var(--c-ink-2)',
  inkFaint:   'var(--c-faint)',
  inkGhost:   'var(--c-line-strong)',
  // Brand
  accent:     'var(--c-primary)',
  accentDark: 'var(--c-primary-hover)',
  violet:     'var(--c-violet)',
  accentSoft: 'var(--c-primary-soft)',
  // Semantics
  positive:   'var(--c-success)',
  negative:   'var(--c-danger)',
  warn:       'var(--c-warning)',
  info:       'var(--c-cyan)',
  // Effects
  heroGradient:  'linear-gradient(135deg,var(--c-primary) 0%,var(--c-violet) 45%,var(--c-primary-hover) 100%)',
  cardShadow:    '0 1px 2px rgba(15,23,42,0.04)',
  cardShadowLg:  '0 10px 30px -10px rgba(15,23,42,0.15)',
  focusRing:     '0 0 0 3px rgba(79,70,229,0.18)',
};

// ── STYLE PRIMITIVES ────────────────────────────────────────────────
// Consumed as inline `style={sx.card}`. Kept as plain objects rather
// than a CSS-in-JS layer so no new dep is needed and the mobile-view
// audit stays trivially inspectable.
export const sx = {
  // Page shell — a tab renders inside AdminDashboard's <main>, so this
  // is just the outer container each tab's body sits in.
  pageHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 20, gap: 12, flexWrap: 'wrap',
  },
  pageTitle: {
    color: T.ink, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0,
  },
  pageSubtitle: {
    color: T.inkMuted, fontSize: 13, marginTop: 4,
  },

  // Hero — reserved for the tab's landing card when the tab needs one
  // (like TabOverview and TabRevenue). Do NOT use on every tab; it's
  // the "here's the flagship number" strip, not decoration.
  hero: {
    background: T.heroGradient, borderRadius: 20, padding: '28px 32px',
    marginBottom: 20, color: 'var(--c-surface)', position: 'relative', overflow: 'hidden',
    boxShadow: '0 10px 30px -10px rgba(79,70,229,0.5)',
  },
  heroGlow: {
    position: 'absolute', top: -80, right: -80, width: 260, height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 65%)',
    pointerEvents: 'none',
  },

  // Card — the workhorse. All list rows, KPI tiles, panels use this.
  card: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
    padding: 18, boxShadow: T.cardShadow,
  },
  // Slightly bigger card for wide panels containing charts
  panel: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16,
    padding: '20px 22px', boxShadow: T.cardShadow,
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
    gap: 12, flexWrap: 'wrap',
  },
  panelTitle: { color: T.ink, fontSize: 14, fontWeight: 700 },
  panelHint:  { color: T.inkFaint, fontSize: 11 },

  // KPI tile — for the metric row atop many tabs
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14, marginBottom: 20,
  },
  kpi: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
    padding: '16px 18px', position: 'relative', overflow: 'hidden',
    transition: 'transform .15s, box-shadow .15s',
  },
  kpiLabel: {
    color: T.inkFaint, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  kpiValue: {
    color: T.ink, fontSize: 24, fontWeight: 800, marginTop: 6,
    letterSpacing: '-0.02em', lineHeight: 1.1,
  },
  kpiSub: { color: T.inkFaint, fontSize: 11, marginTop: 4 },

  // Toolbar: search + filters + refresh row above lists
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    flexWrap: 'wrap', marginBottom: 14,
  },
  searchWrap: {
    flex: '1 1 240px', minWidth: 200, position: 'relative',
    display: 'flex', alignItems: 'center',
  },
  searchInput: {
    width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10,
    border: `1px solid ${T.cardBorder}`, background: T.cardBg,
    fontSize: 13, color: T.ink, outline: 'none',
    fontFamily: "'Sora', system-ui, sans-serif",
  },
  searchIconWrap: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    color: T.inkFaint, pointerEvents: 'none', display: 'flex',
  },

  // Buttons — plain, primary, danger, ghost
  btnBase: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${T.cardBorder}`, background: T.cardBg,
    color: T.inkMuted, fontFamily: "'Sora', system-ui, sans-serif",
    width: 'auto',
  },
  btnPrimary: {
    background: T.accent, color: 'var(--c-surface)', border: `1px solid ${T.accent}`,
  },
  btnDanger: {
    background: 'rgba(239,68,68,0.1)', color: T.negative,
    border: '1px solid rgba(239,68,68,0.3)',
  },
  btnPositive: {
    background: 'rgba(16,185,129,0.15)', color: T.positive,
    border: '1px solid rgba(16,185,129,0.4)',
  },
  btnGhost: {
    background: 'transparent', border: `1px solid ${T.cardBorder}`,
  },

  // Table — for shops/users/distributors lists. Mobile switches to a
  // stacked card view via CSS class .admin-table-mobile (defined below).
  tableWrap: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
    boxShadow: T.cardShadow, overflow: 'hidden',
  },
  tableRow: {
    display: 'grid', alignItems: 'center', padding: '14px 18px', gap: 12,
    borderTop: `1px solid ${T.divider}`,
  },
  tableRowFirst: { borderTop: 'none' },
  tableHeader: {
    display: 'grid', alignItems: 'center', padding: '12px 18px', gap: 12,
    color: T.inkFaint, fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    background: T.bg, borderBottom: `1px solid ${T.cardBorder}`,
  },

  // Chips + status pills
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
  },

  // Empty state — same look everywhere, so admin never sees mismatched
  // "no data" screens across tabs.
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 200, gap: 8, color: T.inkMuted,
    padding: 24, textAlign: 'center',
  },
};

// ── UTILITIES ──────────────────────────────────────────────────────
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `${(v/1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v/1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v/1e3).toFixed(1)}k`;
  return String(v);
};

// ── GLOBAL ADMIN CSS ────────────────────────────────────────────────
// Injected once by AdminDashboard. Covers keyframes shared by every tab
// (spin, pulse, fadeIn) and the mobile-safe overrides for grids that
// would otherwise cause horizontal scrolling on narrow viewports.
export const ADMIN_GLOBAL_CSS = `
  @keyframes admin-spin { to { transform: rotate(360deg); } }
  @keyframes admin-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
  @keyframes admin-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  /* Base fade-in for tab content — feels alive without being distracting */
  .admin-tab-content { animation: admin-fadein 0.25s ease-out; }

  /* KPI hover lift — subtle, applied by class from sx.kpi */
  .admin-kpi:hover { transform: translateY(-1px); box-shadow: 0 4px 16px -8px rgba(15,23,42,0.15); }
  .admin-kpi { transition: transform .15s, box-shadow .15s; }

  /* Mobile: crank down padding, hide desktop-only chrome */
  @media (max-width: 1023px) {
    .admin-hide-mobile { display: none !important; }
    .admin-hero, .admin-panel, .admin-card {
      padding: 18px 16px !important; border-radius: 14px !important;
    }
    .admin-hero { padding: 22px 20px !important; }
    /* Any element flagged as a data table row switches to a stacked
       flexbox on mobile so columns don't get squeezed to zero width. */
    .admin-table-row {
      grid-template-columns: 1fr !important;
      gap: 6px !important;
      padding: 14px 16px !important;
    }
    .admin-table-header { display: none !important; }
    /* Touch tap targets — anything <36px feels bad on a phone */
    .admin-tap { min-height: 40px; padding: 10px 14px; }
  }

  /* Focus states — enterprise dashboards need visible keyboard focus */
  .admin-focusable:focus-visible {
    outline: none;
    box-shadow: ${T.focusRing};
  }
`;
