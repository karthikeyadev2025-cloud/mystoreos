// ─────────────────────────────────────────────────────────────────────
// LANDING DESIGN TOKENS — "The Ledger"
//
// The artifact MyStore OS replaces is the bahi khata: the bound account
// book that sits by the till in every Indian shop, and in the drawer of
// every salon and clinic. Ruled rows, a red margin rule, blue column
// rules, figures stacked in tabular columns.
//
// The page is built from that object. Not skeuomorphically — no paper
// textures, no drop-shadowed book spines — but structurally: hairline
// rules instead of colour blocks, mono figures right-aligned like a real
// column, a red margin rule running the length of the page.
//
// Brand indigo is retained for ACTIONS ONLY (buttons, links). The app
// itself is indigo, and a landing page in an unrelated palette makes
// signup feel like you walked into a different building.
// ─────────────────────────────────────────────────────────────────────

export const T = {
  // Ground
  paper:      '#FAF8F3',   // ledger stock — warm, but yellower than the usual cream
  paperDeep:  '#F2EEE5',   // alternating band / raised surface
  rule:       '#E4DDD0',   // hairline row rules
  ruleStrong: '#CFC5B2',   // section divisions

  // Ink
  ink:        '#1A2230',   // body — blue-black, like fountain pen
  inkDeep:    '#0C121B',   // headings
  inkSoft:    '#5A6472',   // secondary
  inkFaint:   '#909AA6',   // captions, meta

  // The one hot accent: the red margin rule of an account book.
  // Used for the margin line, debits, and nothing else. Restraint is
  // what keeps it meaningful.
  marginRed:  '#C4362C',
  marginRedSoft: 'rgba(196,54,44,0.08)',

  // Accounting green — credits, confirmations, positive deltas.
  credit:     '#1F6F4A',
  creditSoft: 'rgba(31,111,74,0.08)',

  // Brand — actions only.
  brand:      '#4F46E5',
  brandDeep:  '#4338CA',
  brandSoft:  'rgba(79,70,229,0.07)',
};

// Type roles.
//   display — Archivo. Sturdy, slightly industrial; the flavour of
//             official forms and shop signage. Not a serif cliché.
//   body    — Inter. Quiet. Lets Archivo carry the personality.
//   mono    — JetBrains Mono. EVERY figure, eyebrow, and column label.
//             This is the texture that sells the ledger.
export const F = {
  display: "'Archivo', system-ui, sans-serif",
  body:    "'Inter', system-ui, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, 'Courier New', monospace",
};

// Shared CSS injected once by LandingPage. Contains the font imports,
// the ruled-grid primitives, and motion that respects prefers-reduced.
export const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

html { scroll-behavior: smooth; }
*, *::before, *::after { box-sizing: border-box; }

/* ── Eyebrow: a ledger column header. Mono, tracked, small caps feel. */
.lx-eyebrow {
  font-family: ${F.mono};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${T.inkFaint};
}

/* ── Section title */
.lx-title {
  font-family: ${F.display};
  font-weight: 800;
  letter-spacing: -0.025em;
  color: ${T.inkDeep};
  line-height: 1.08;
  margin: 12px 0 0;
}

/* ── Standfirst under a title */
.lx-lede {
  font-family: ${F.body};
  color: ${T.inkSoft};
  font-size: 16px;
  line-height: 1.7;
  margin: 14px 0 0;
}

/* ── Figures. Always mono, always tabular, right-aligned in columns. */
.lx-fig {
  font-family: ${F.mono};
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* ── The rule. Hairline, warm, never grey. */
.lx-rule { border: 0; border-top: 1px solid ${T.rule}; margin: 0; }

/* ── Ledger row: the page's fundamental unit. */
.lx-row {
  display: grid;
  align-items: center;
  gap: 16px;
  padding: 13px 0;
  border-bottom: 1px solid ${T.rule};
}
.lx-row:last-child { border-bottom: 0; }

/* ── Buttons. The only place brand indigo appears at full strength. */
.lx-btn {
  font-family: ${F.body};
  font-weight: 600;
  font-size: 15px;
  border-radius: 8px;
  padding: 13px 24px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  width: auto;
  text-decoration: none;
}
.lx-btn-primary {
  background: ${T.brand};
  color: #fff;
  box-shadow: 0 1px 2px rgba(26,34,48,0.14);
}
.lx-btn-primary:hover { background: ${T.brandDeep}; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(79,70,229,0.28); }
.lx-btn-ghost {
  background: transparent;
  color: ${T.ink};
  border-color: ${T.ruleStrong};
}
.lx-btn-ghost:hover { background: ${T.paperDeep}; border-color: ${T.inkFaint}; }

/* ── Tabs. Read as ledger column tabs, not pill chips. */
.lx-tab {
  font-family: ${F.mono};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  color: ${T.inkFaint};
  padding: 10px 4px;
  cursor: pointer;
  width: auto;
  transition: color .15s, border-color .15s;
}
.lx-tab:hover { color: ${T.ink}; }
.lx-tab[data-active='true'] {
  color: ${T.inkDeep};
  border-bottom-color: ${T.marginRed};
}

/* ── Focus: visible, always. Non-negotiable. */
.lx-btn:focus-visible,
.lx-tab:focus-visible,
a:focus-visible {
  outline: 2px solid ${T.brand};
  outline-offset: 3px;
}

/* ── Entry animation: rows write themselves in, like someone posting
      the day's entries. Staggered by index via inline delay. */
@keyframes lx-post {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
.lx-post { animation: lx-post .45s cubic-bezier(.2,.7,.3,1) both; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .lx-post { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`;
