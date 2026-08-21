#!/usr/bin/env node
/**
 * theme-codemod — replace hardcoded hex colors with design tokens.
 *
 *   node scripts/theme-codemod.mjs --dry     report only (default)
 *   node scripts/theme-codemod.mjs --write   apply
 *
 * WHY THIS IS NOT A FIND-AND-REPLACE
 * ---------------------------------
 * `var(--c-primary)` resolves in CSS. It does NOT resolve in:
 *
 *   - SVG presentation attributes: <rect fill="#4F46E5"> and every
 *     recharts <Bar fill=...> / <Line stroke=...>. Attributes are not
 *     CSS declarations; the browser drops the value and the shape
 *     renders black or not at all. 48 of these in this repo.
 *   - canvas: ctx.fillStyle = 'var(--x)' silently paints black.
 *   - jsPDF: setTextColor / setFillColor parse numbers or literal hex.
 *     161 calls here — this is invoice and receipt output.
 *   - Capacitor StatusBar.setBackgroundColor: native call, needs a
 *     literal.
 *   - The print/thermal HTML in src/lib/invoiceTemplates.js and
 *     thermalReceipt.js: that markup is injected into a fresh print
 *     window or sent to a thermal printer, where the app's stylesheet
 *     and therefore :root has never been loaded.
 *
 * Every one of those fails SILENTLY — no console error, no build
 * warning. You would find out when a customer's invoice printed blank.
 *
 * So: files in FILE_DENYLIST are skipped whole, and inside every other
 * file any line matching LINE_DENYLIST is left alone. Those places keep
 * literal hex — theme-literals.mjs updates their values separately.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const WRITE = process.argv.includes('--write');
const ROOT = 'src';

/* Files where NO occurrence may become a var(). */
const FILE_DENYLIST = [
  /* The token file DEFINES the palette. Converting a literal here would
     produce `--c-cyan-strong: var(--c-cyan-strong)` — a self-reference
     that resolves to nothing and takes the color with it. */
  'src/styles/tokens.css',
  'src/lib/invoiceTemplates.js',   // print-window HTML, no :root
  'src/lib/thermalReceipt.js',     // thermal printer ESC/POS HTML
  'src/lib/pdfGenerator.js',       // jsPDF
  'src/lib/invoicePrint.js',       // print window
  'src/lib/native.js',             // Capacitor StatusBar
  'src/lib/capacitorInit.js',      // Capacitor StatusBar
];

/* Lines that keep literal hex even in an allowed file. */
const LINE_DENYLIST = [
  /\bfill\s*=/,            // SVG / recharts attribute
  /\bstroke\s*=/,
  /\bfillStyle\b/,         // canvas
  /\bstrokeStyle\b/,
  /\bsetTextColor\b/,      // jsPDF
  /\bsetFillColor\b/,
  /\bsetDrawColor\b/,
  /StatusBar/,             // native
  /theme[-_]?color/i,      // <meta>
  /stopColor/,             // SVG gradients
  /\bcolor\s*:\s*\[/,      // color arrays passed to chart libs
  /type\s*=\s*["']color["']/,  // <input type="color"> — parses hex only
];


/* Hex that must stay exactly as-is. Not "unmapped" — deliberately kept.
 *
 *   WhatsApp and Google brand colors: a "Share on WhatsApp" button that
 *   isn't WhatsApp green stops being recognisable, and Google's sign-in
 *   mark has brand guidelines attached to it. (The Google logo paths are
 *   already inside fill= attributes and so caught by LINE_DENYLIST; they
 *   are listed here too so the intent is explicit rather than incidental.)
 *
 *   #000000 is the fallback for <input type="color"> in TabDesign — a
 *   native color picker parses hex only, and var() there yields an empty
 *   value and a picker stuck on black.
 */
const PRESERVE = new Set([
  '#25d366', '#128c7e',                          // WhatsApp
  '#4285f4', '#34a853', '#ea4335', '#fbbc05',    // Google
  '#000000',                                     // <input type="color"> fallback
]);

/* hex -> token. Only high-confidence mappings; anything not listed is
   left alone and reported so it can be judged by hand. */
const MAP = {
  '#0f172a': '--c-ink',
  '#1e293b': '--c-ink',
  '#334155': '--c-ink-2',
  '#475569': '--c-ink-2',
  '#64748b': '--c-muted',
  '#94a3b8': '--c-faint',
  '#cbd5e1': '--c-line-strong',
  '#e2e8f0': '--c-line',
  '#f1f5f9': '--c-line-soft',
  '#f8fafc': '--c-bg',
  '#ffffff': '--c-surface',
  '#fff':     '--c-surface',

  '#4f46e5': '--c-primary',
  '#4338ca': '--c-primary-hover',
  '#818cf8': '--c-primary-light',
  '#6366f1': '--c-primary-light',
  '#eef2ff': '--c-primary-soft',
  '#c7d2fe': '--c-primary-border',

  '#10b981': '--c-success',
  '#059669': '--c-success-strong',
  '#16a34a': '--c-success-strong',
  '#ecfdf5': '--c-success-soft',
  '#d1fae5': '--c-success-soft',

  '#f59e0b': '--c-warning',
  '#d97706': '--c-accent-hover',
  '#b45309': '--c-warning-strong',
  '#92400e': '--c-warning-strong',
  '#fef3c7': '--c-warning-soft',

  '#ef4444': '--c-danger',
  '#dc2626': '--c-danger-strong',
  '#b91c1c': '--c-danger-strong',
  '#fca5a5': '--c-danger-border',
  '#fef2f2': '--c-danger-soft',
  '#fee2e2': '--c-danger-soft',

  '#3b82f6': '--c-info',

  // ---- neutrals: the gray-* family used alongside slate-* ----
  '#111827': '--c-ink',
  '#1f2937': '--c-ink-2',
  '#374151': '--c-ink-2',
  '#6b7280': '--c-muted',
  '#9ca3af': '--c-faint',
  '#d1d5db': '--c-line-strong',
  '#e5e7eb': '--c-line',
  '#f3f4f6': '--c-line-soft',
  '#f4f5f7': '--c-line-soft',
  '#f9fafb': '--c-surface-2',
  '#fbfbf7': '--c-surface-2',

  // ---- dark surfaces & gradient stops (old indigo/near-black) ----
  '#0d1117': '--c-ink-surface',
  '#0c1120': '--c-ink-surface',
  '#090514': '--c-ink-surface',
  '#0f0c29': '--c-ink-surface',
  '#161b22': '--c-ink-surface-2',
  '#161f35': '--c-ink-surface-2',
  '#1e222d': '--c-ink-surface-2',
  '#120f2d': '--c-ink-surface-2',
  '#24243e': '--c-ink-surface-2',
  '#2a2f3d': '--c-ink-surface-3',
  '#1e1b4b': '--c-primary-hover',
  '#312e81': '--c-primary',
  '#3730a3': '--c-primary',
  '#302b63': '--c-primary',

  // ---- success ----
  '#22c55e': '--c-success',
  '#34d399': '--c-success',
  '#15803d': '--c-success-strong',
  '#047857': '--c-success-strong',
  '#065f46': '--c-success-strong',
  '#166534': '--c-success-strong',
  '#2e7d32': '--c-success-strong',
  '#a7f3d0': '--c-success-soft',
  '#6ee7b7': '--c-success-soft',
  '#86efac': '--c-success-soft',
  '#bbf7d0': '--c-success-soft',
  '#dcfce7': '--c-success-soft',
  '#f0fdf4': '--c-success-soft',
  '#e8f5e9': '--c-success-soft',
  '#a5d6a7': '--c-success-soft',

  // ---- danger ----
  '#e11d48': '--c-danger',
  '#f43f5e': '--c-danger',
  '#fb7185': '--c-danger',
  '#f87171': '--c-danger',
  '#991b1b': '--c-danger-strong',
  '#7f1d1d': '--c-danger-strong',
  '#fecaca': '--c-danger-border',
  '#fff5f5': '--c-danger-soft',

  // ---- warning / amber ----
  '#fbbf24': '--c-warning',
  '#fcd34d': '--c-warning',
  '#f5b942': '--c-warning',
  '#ca8a04': '--c-warning-strong',
  '#b8860b': '--c-warning-strong',
  '#78350f': '--c-warning-strong',
  '#fde68a': '--c-accent-border',
  '#fffbeb': '--c-warning-soft',

  // ---- orange (restock / expiry) ----
  '#f97316': '--c-orange',
  '#ea580c': '--c-orange',
  '#c2410c': '--c-orange-strong',
  '#fdba74': '--c-orange-soft',
  '#fed7aa': '--c-orange-soft',
  '#ffedd5': '--c-orange-soft',
  '#fff7ed': '--c-orange-soft',

  // ---- blue (info / links) ----
  '#1d4ed8': '--c-primary',
  '#2563eb': '--c-primary',
  '#0284c7': '--c-primary',
  '#60a5fa': '--c-primary-light',
  '#93c5fd': '--c-primary-light',
  '#a5b4fc': '--c-primary-light',
  '#bfdbfe': '--c-primary-border',
  '#dbeafe': '--c-primary-soft',
  '#eff6ff': '--c-primary-soft',
  '#e0e7ff': '--c-primary-soft',

  // ---- cyan (CA / reports) ----
  '#06b6d4': '--c-cyan',
  '#0ea5e9': '--c-cyan',
  '#22d3ee': '--c-cyan',

  // ---- violet (loyalty / membership / signup) ----
  '#7c3aed': '--c-violet',
  '#8b5cf6': '--c-violet',
  '#a78bfa': '--c-violet',
  '#c084fc': '--c-violet',
  '#6d28d9': '--c-violet-strong',
  '#ddd6fe': '--c-violet-soft',
  '#e9d5ff': '--c-violet-soft',
  '#f3e8ff': '--c-violet-soft',
  '#f5f3ff': '--c-violet-soft',
  '#faf5ff': '--c-violet-soft',
  '#fef2fe': '--c-violet-soft',

  // ---- rose (feedback / ratings) ----
  '#ec4899': '--c-rose',

  // ---- long tail: one-off shades that duplicate an existing role ----
  '#020617': '--c-ink-surface',
  '#080b14': '--c-ink-surface',
  '#090d16': '--c-ink-surface',
  '#0a1628': '--c-ink-surface',
  '#0c121b': '--c-ink-surface',
  '#11151c': '--c-ink-surface',
  '#1a202c': '--c-ink-surface-2',
  '#131c2d': '--c-ink-surface-2',
  '#0a1f0a': '--c-ink-surface-2',
  '#1a0f00': '--c-ink-surface-2',
  '#1e0e0e': '--c-ink-surface-2',
  '#241d13': '--c-ink-surface-3',
  '#6473a0': '--c-primary-light',
  '#2f7fff': '--c-primary',
  '#5a6472': '--c-muted',
  '#909aa6': '--c-faint',
  '#9aa2b0': '--c-faint',
  '#b0b8c3': '--c-faint',
  '#f0f0f0': '--c-line-soft',
  '#fafafa': '--c-surface-2',
  '#fafafb': '--c-surface-2',
  '#fbfaf7': '--c-surface-2',
  '#f8faff': '--c-primary-soft',
  '#fffbfa': '--c-danger-soft',
  '#fff1f2': '--c-danger-soft',
  '#ffe4e6': '--c-danger-soft',
  '#e53e3e': '--c-danger',
  '#064e3b': '--c-success-strong',
  '#099268': '--c-success-strong',
  '#1fad53': '--c-success',
  '#4ade80': '--c-success',
  '#84cc16': '--c-success',
  '#c3fae8': '--c-success-soft',
  '#e6fcf5': '--c-success-soft',
  '#0891b2': '--c-cyan',
  '#cffafe': '--c-cyan-soft',
  '#5b21b6': '--c-violet-strong',
  '#9a3412': '--c-orange-strong',
  '#fb923c': '--c-orange',
  '#a16207': '--c-warning-strong',
  '#e8a020': '--c-accent-hover',
  '#fde047': '--c-warning',
  '#ffe066': '--c-warning',
  '#fef9c3': '--c-warning-soft',
  '#fff9db': '--c-warning-soft',
  '#be123c': '--c-rose-strong',
  '#831843': '--c-rose-strong',
  '#9d174d': '--c-rose-strong',
  '#f472b6': '--c-rose',
  '#f9a8d4': '--c-rose-soft',
  '#fbcfe8': '--c-rose-soft',
  '#fce7f3': '--c-rose-soft',


};

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.js', '.jsx', '.css'].includes(extname(p))) out.push(p);
  }
  return out;
};

const norm = (h) => {
  const v = h.toLowerCase();
  return v.length === 4 ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v;
};

let converted = 0, skippedLine = 0, skippedFile = 0, unmapped = new Map();
const touched = [];

for (const file of walk(ROOT)) {
  const rel = file.replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');

  if (FILE_DENYLIST.includes(rel)) {
    skippedFile += (src.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length;
    continue;
  }

  let fileCount = 0;
  const out = src.split('\n').map((line) => {
    if (LINE_DENYLIST.some((re) => re.test(line))) {
      skippedLine += (line.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length;
      return line;
    }
    return line.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
      if (hex.length === 9) return hex;            // 8-digit = has alpha, leave it
      if (PRESERVE.has(norm(hex))) return hex;     // brand / native-picker literals
      const token = MAP[norm(hex)];
      if (!token) {
        unmapped.set(norm(hex), (unmapped.get(norm(hex)) || 0) + 1);
        return hex;
      }
      fileCount++; converted++;
      return `var(${token})`;
    });
  }).join('\n');

  if (fileCount) {
    touched.push([rel, fileCount]);
    if (WRITE) writeFileSync(file, out);
  }
}

console.log(WRITE ? '=== APPLIED ===' : '=== DRY RUN (use --write) ===');
console.log(`converted to tokens : ${converted}`);
console.log(`kept literal (line)  : ${skippedLine}   [svg/canvas/pdf/native]`);
console.log(`kept literal (file)  : ${skippedFile}   [print & pdf modules]`);
console.log(`files changed        : ${touched.length}`);

const top = [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
if (top.length) {
  console.log('\nunmapped (left as-is, review by hand):');
  for (const [h, n] of top) console.log(`  ${String(n).padStart(4)}  ${h}`);
}
