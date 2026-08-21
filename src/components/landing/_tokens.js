// ─────────────────────────────────────────────────────────────────────
// LANDING TOKENS — light ground, printed ledger.
//
// This page used to be a dark "void" with glowing panels. The idea was
// good and is kept: the day book is still the hero, two facing pages,
// retail left and services right, both posting into one Day Total. The
// artwork is still the argument.
//
// What changed is the light. Reasons, in order of weight:
//
//   1. Every competitor in this category — Vyapar, myBillBook, Zoho
//      Books, Tally — is light. Dark reads as developer tool or crypto.
//      Software that touches a shopkeeper's money and their GST filing
//      should feel trustworthy and faintly boring, not moody.
//   2. The dashboard is warm cream now. A dark landing opening into a
//      light app is a visible seam at exactly the wrong moment: signup.
//   3. The audience is on mid-range Android in Indian daylight. Dark
//      surfaces on a cheap LCD in sunlight are genuinely harder to read.
//   4. heynikki.in is light. Same company, same face.
//
// Depth now comes from print, not from glow:
//   1. the ground     — warm cream, the page the ledger sits on
//   2. the surface    — white panels, lifted by a soft shadow
//   3. the artifact   — the day book, ruled and legible
//
// Navy carries the structure. Amber is the second voice and is reserved
// for money — totals, the bottom line, the thing that pays the bill.
//
// A note on the glows: on a dark ground a blurred colour pool reads as
// atmosphere. On cream it reads as a printing defect. They are kept but
// pulled right down and warmed, so they tint the ground rather than
// announce themselves.
// ─────────────────────────────────────────────────────────────────────

export const T = {
  // Ground — the warm cream from heynikki.in
  void:        'var(--c-bg)',
  voidLift:    'var(--c-surface-2)',
  surface:     'var(--c-surface)',
  surfaceLift: 'var(--c-surface)',

  // Hairlines and edges — warm sand, the ruled lines of a ledger
  edge:        'var(--c-line)',
  edgeLift:    'var(--c-line-strong)',
  edgeGlow:    'var(--c-primary-border)',

  // Text
  text:        'var(--c-ink)',
  textSoft:    'var(--c-muted)',
  textFaint:   'var(--c-faint)',
  // On the dark page this was a barely-there tint used for step numbers
  // and column heads. Ported literally it became a border colour used as
  // text at 1.75:1. It is a real, readable grey now.
  textGhost:   'var(--c-faint)',

  // Brand — navy carries the structure
  brand:       'var(--c-primary)',
  brandBright: 'var(--c-primary)',
  brandDeep:   'var(--c-primary-hover)',
  brandGlow:   'rgba(18, 69, 122, 0.10)',

  // Amber — money, totals, the bottom line. The second voice.
  // Amber as a FILL. For amber-coloured TEXT use goldText — plain amber
  // measures 2.09:1 on white and cannot be read at any size.
  gold:        'var(--c-accent)',
  goldText:    'var(--c-accent-text)',
  goldBright:  'var(--c-accent-hover)',
  goldGlow:    'rgba(233, 167, 44, 0.14)',

  // Semantics
  green:       'var(--c-success-strong)',
  greenGlow:   'rgba(34, 197, 94, 0.10)',
  rose:        'var(--c-danger)',
  roseGlow:    'rgba(194, 56, 43, 0.10)',
};

export const F = {
  // The same three faces as the rest of the app, self-hosted. This page
  // previously pulled Archivo and Inter from Google's CDN — a different
  // typeface family from the product it was selling, and a network
  // dependency that fails offline in the Capacitor wrapper.
  display: "var(--font-display)",
  body:    "var(--font-sans)",
  mono:    "var(--font-mono)",
};

export const LANDING_CSS = `
/* No CDN import. See F below — the landing page now uses the same
   self-hosted brand faces as the rest of the app. */

html { scroll-behavior: smooth; }
*, *::before, *::after { box-sizing: border-box; }

/* ── Ambient light. Two soft pools of colour bleeding through the void,
      so the page has atmosphere rather than being a flat black rectangle. */
/* Kept, but at a fraction of the strength. A blurred colour pool on a
   dark ground reads as atmosphere; the same pool on cream reads as a
   printing defect. At this opacity it only warms the ground. */
.lx-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(110px);
  opacity: 0.35;
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
/* On a dark ground a panel is lifted by an inner white highlight and a
   deep shadow. On cream neither works: the highlight is invisible and
   the shadow reads as grime. A white panel on cream separates by value
   alone, so it needs only a hairline and a soft, warm-tinted shadow. */
.lx-surface {
  background: ${T.surface};
  border: 1px solid ${T.edge};
  border-radius: 16px;
  box-shadow:
    0 1px 2px rgba(11, 31, 51, 0.04),
    0 12px 32px -16px rgba(11, 31, 51, 0.12);
}
.lx-surface-hover { transition: transform .2s cubic-bezier(.2,.7,.3,1), box-shadow .2s, border-color .2s; }
.lx-surface-hover:hover {
  transform: translateY(-3px);
  border-color: ${T.edgeGlow};
  box-shadow:
    0 1px 2px rgba(11, 31, 51, 0.05),
    0 22px 44px -20px rgba(11, 31, 51, 0.18);
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
  background: ${T.brandBright};
  color: var(--c-ink-inverse);
  box-shadow: 0 1px 2px rgba(11, 31, 51, 0.10);
}
.lx-btn-primary:hover {
  transform: translateY(-2px);
  background: ${T.brandDeep};
  box-shadow: 0 6px 18px -6px rgba(18, 69, 122, 0.45);
}
.lx-btn-ghost {
  background: ${T.surface};
  color: ${T.text};
  border-color: ${T.edgeLift};
}
.lx-btn-ghost:hover {
  background: var(--c-surface-2);
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
  background: ${T.surface};
  border: 1px solid ${T.edge};
  border-radius: 8px;
  color: ${T.textSoft};
  padding: 10px 18px;
  cursor: pointer;
  width: auto;
  transition: all .18s;
}
.lx-tab:hover { color: ${T.text}; border-color: ${T.edgeLift}; background: var(--c-surface-2); }
.lx-tab[data-active='true'] {
  color: var(--c-ink-inverse);
  background: ${T.brandBright};
  border-color: transparent;
  box-shadow: 0 1px 2px rgba(11, 31, 51, 0.10);
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
  background: ${T.surface};
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
