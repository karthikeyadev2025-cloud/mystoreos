// ─────────────────────────────────────────────────────────────────────
// LANDING TOKENS — deep ground, lit surfaces.
//
// The ledger stays as the structural idea (ruled rows, tabular figures,
// the day book as the hero artifact) — but it's lit from within rather
// than printed flat. Think a premium product shot of the book, not a
// photocopy of it.
//
// Depth comes from three layers:
//   1. the void      — the page ground, near-black with a blue cast
//   2. the surface   — raised panels, lifted off the void by light
//   3. the artifact  — the day book, glowing, the thing you look at
//
// Brand indigo carries all the energy. The gold is the second voice —
// used for money, totals, and the things that make a shopkeeper money.
// ─────────────────────────────────────────────────────────────────────

export const T = {
  // Ground — near-black, cooled with blue so it reads as depth, not soot
  void:        '#080B14',
  voidLift:    '#0C1120',
  surface:     '#111827',
  surfaceLift: '#161F35',

  // Hairlines and edges
  edge:        'rgba(255,255,255,0.08)',
  edgeLift:    'rgba(255,255,255,0.14)',
  edgeGlow:    'rgba(129,140,248,0.35)',

  // Text
  text:        '#F8FAFC',
  textSoft:    'rgba(248,250,252,0.62)',
  textFaint:   'rgba(248,250,252,0.38)',
  textGhost:   'rgba(248,250,252,0.22)',

  // Brand — the energy of the page
  brand:       '#6366F1',
  brandBright: '#818CF8',
  brandDeep:   '#4F46E5',
  brandGlow:   'rgba(99,102,241,0.28)',

  // Gold — money, totals, the bottom line. The second voice.
  gold:        '#F5B942',
  goldBright:  '#FCD34D',
  goldGlow:    'rgba(245,185,66,0.22)',

  // Semantics
  green:       '#34D399',
  greenGlow:   'rgba(52,211,153,0.18)',
  rose:        '#FB7185',
  roseGlow:    'rgba(251,113,133,0.18)',
};

export const F = {
  display: "'Archivo', system-ui, sans-serif",
  body:    "'Inter', system-ui, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, 'Courier New', monospace",
};

export const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

html { scroll-behavior: smooth; }
*, *::before, *::after { box-sizing: border-box; }

/* ── Ambient light. Two soft pools of colour bleeding through the void,
      so the page has atmosphere rather than being a flat black rectangle. */
.lx-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(90px);
  z-index: 0;
}

/* ── Eyebrow — a ledger column header */
.lx-eyebrow {
  font-family: ${F.mono};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${T.brandBright};
}

.lx-title {
  font-family: ${F.display};
  font-weight: 800;
  letter-spacing: -0.03em;
  color: ${T.text};
  line-height: 1.06;
  margin: 14px 0 0;
}

.lx-lede {
  font-family: ${F.body};
  color: ${T.textSoft};
  font-size: 16.5px;
  line-height: 1.75;
  margin: 16px 0 0;
}

/* ── Figures. Tabular, always. */
.lx-fig {
  font-family: ${F.mono};
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* ── Surface. A raised panel, lifted off the void by a light edge on top
      and a shadow beneath. This is what stops the page reading flat. */
.lx-surface {
  background: linear-gradient(180deg, ${T.surfaceLift} 0%, ${T.surface} 100%);
  border: 1px solid ${T.edge};
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    0 1px 2px rgba(0,0,0,0.4),
    0 12px 40px -12px rgba(0,0,0,0.6);
}
.lx-surface-hover { transition: transform .2s cubic-bezier(.2,.7,.3,1), box-shadow .2s, border-color .2s; }
.lx-surface-hover:hover {
  transform: translateY(-3px);
  border-color: ${T.edgeGlow};
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.09),
    0 1px 2px rgba(0,0,0,0.4),
    0 20px 50px -14px rgba(0,0,0,0.7),
    0 0 40px -12px ${T.brandGlow};
}

/* ── Buttons */
.lx-btn {
  font-family: ${F.body};
  font-weight: 600;
  font-size: 15px;
  border-radius: 10px;
  padding: 14px 26px;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  width: auto;
  text-decoration: none;
  transition: transform .15s cubic-bezier(.2,.7,.3,1), box-shadow .15s, filter .15s;
  position: relative;
}
.lx-btn-primary {
  background: linear-gradient(135deg, ${T.brandBright}, ${T.brandDeep});
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.25),
    0 2px 8px rgba(0,0,0,0.4),
    0 0 32px -6px ${T.brandGlow};
}
.lx-btn-primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.3),
    0 4px 14px rgba(0,0,0,0.5),
    0 0 52px -6px ${T.brandGlow};
}
.lx-btn-ghost {
  background: rgba(255,255,255,0.04);
  color: ${T.text};
  border-color: ${T.edgeLift};
  backdrop-filter: blur(8px);
}
.lx-btn-ghost:hover {
  background: rgba(255,255,255,0.08);
  border-color: ${T.edgeGlow};
  transform: translateY(-2px);
}

/* ── Tabs */
.lx-tab {
  font-family: ${F.mono};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(255,255,255,0.03);
  border: 1px solid ${T.edge};
  border-radius: 8px;
  color: ${T.textFaint};
  padding: 10px 18px;
  cursor: pointer;
  width: auto;
  transition: all .18s;
}
.lx-tab:hover { color: ${T.text}; border-color: ${T.edgeLift}; background: rgba(255,255,255,0.06); }
.lx-tab[data-active='true'] {
  color: #fff;
  background: linear-gradient(135deg, ${T.brandBright}, ${T.brandDeep});
  border-color: transparent;
  box-shadow: 0 0 28px -6px ${T.brandGlow}, inset 0 1px 0 rgba(255,255,255,0.25);
}

/* ── Pills / chips */
.lx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${F.mono};
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid ${T.edge};
  background: rgba(255,255,255,0.04);
  color: ${T.textSoft};
}

/* ── Focus */
.lx-btn:focus-visible, .lx-tab:focus-visible, a:focus-visible, button:focus-visible {
  outline: 2px solid ${T.brandBright};
  outline-offset: 3px;
}

/* ── Motion */
@keyframes lx-post { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes lx-pulse { 0%,100% { opacity: .5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
@keyframes lx-drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(18px,-24px); } }
.lx-post { animation: lx-post .5s cubic-bezier(.2,.7,.3,1) both; }
.lx-pulse { animation: lx-pulse 2.4s ease-in-out infinite; }
.lx-drift { animation: lx-drift 16s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .lx-post { animation: none !important; opacity: 1 !important; transform: none !important; }
  .lx-drift, .lx-pulse { animation: none !important; }
}
`;
