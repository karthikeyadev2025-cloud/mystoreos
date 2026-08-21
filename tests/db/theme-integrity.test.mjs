// Theme integrity guard.  node tests/db/theme-integrity.test.mjs
//
// Four failures this catches, all of which happened or nearly happened
// while the rebrand was being applied:
//
//   1. A token defined as itself. The codemod originally ran over
//      tokens.css and turned `--c-success: #22C55E` into
//      `--c-success: var(--c-success)`. That resolves to nothing, so
//      every success badge in the app loses its color — and nothing
//      errors. Four tokens were corrupted this way before tokens.css
//      was added to the codemod's FILE_DENYLIST.
//
//   2. A var() pointing at a token that does not exist. Typo a token
//      name and the property is simply dropped by the browser.
//
//   3. A var() inside the print, thermal or PDF modules. Those run
//      where :root was never loaded, so the color silently disappears
//      from a customer's invoice.
//
//   4. A var() in an SVG fill/stroke attribute or a native call, which
//      the CSS cascade does not reach.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ok = [], bad = [];
const check = (n, c, d = '') =>
  (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '\n        ' + d : ''}`);

const TOKENS = 'src/styles/tokens.css';
const css = readFileSync(TOKENS, 'utf8');

// ── 1. no token defined as itself ───────────────────────────────────
const selfRefs = [];
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)/gim)) {
  if (m[1] === m[2]) selfRefs.push(m[1]);
}
check('no token defined as itself', selfRefs.length === 0, selfRefs.join(', '));

// ── 2. every var() resolves to a defined token ──────────────────────
const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.js', '.jsx', '.css'].includes(extname(p))) out.push(p);
  }
  return out;
};
const files = walk('src');

const dangling = new Map();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    if (!defined.has(m[1]) && !dangling.has(m[1])) dangling.set(m[1], f);
  }
}
check('every var() resolves to a defined token', dangling.size === 0,
      [...dangling].map(([t, f]) => `${t} (${f})`).slice(0, 6).join(', '));

// ── 3. no var() in print / PDF / native modules ─────────────────────
const NO_VAR_FILES = [
  'src/lib/invoiceTemplates.js',
  'src/lib/thermalReceipt.js',
  'src/lib/pdfGenerator.js',
  'src/lib/invoicePrint.js',
  'src/lib/native.js',
  'src/lib/capacitorInit.js',
];
for (const f of NO_VAR_FILES) {
  let body = '';
  try { body = readFileSync(f, 'utf8'); } catch { continue; }
  const n = (body.match(/var\(--/g) || []).length;
  check(`no CSS var in ${f.split('/').pop()}`, n === 0, n ? `${n} occurrence(s)` : '');
}

// ── 4. no var() where the cascade does not reach ────────────────────
const RISKY = [
  [/\b(?:fill|stroke)\s*=\s*["'{]?\s*["']?var\(--/, 'SVG presentation attribute'],
  [/\bfillStyle\s*=\s*['"`]var\(--/,               'canvas fillStyle'],
  [/\bset(?:Text|Fill|Draw)Color\(\s*['"`]var\(--/, 'jsPDF color call'],
  [/setBackgroundColor\(\{[^}]*var\(--/,            'Capacitor StatusBar'],
  [/type\s*=\s*["']color["'][^>]*var\(--/,          '<input type="color">'],
];
const leaks = [];
for (const f of files) {
  const body = readFileSync(f, 'utf8');
  for (const [re, label] of RISKY) if (re.test(body)) leaks.push(`${label} in ${f}`);
}
check('no var() where the cascade cannot reach', leaks.length === 0, leaks.slice(0, 5).join('; '));

// ── 5. the old typeface is actually gone ────────────────────────────
// The palette swap originally shipped alongside a font change that did
// nothing: index.html carried a universal selector
// *{font-family:'Plus Jakarta Sans'} plus several !important rules and
// 117 hardcoded references, so every new font token was overridden and
// the app still rendered in the old face while Manrope was downloaded
// from a CDN and used by nothing. Colors were verifiable at a glance;
// typography was not, which is exactly why it needs a test.
const OLD_FACES = ['Plus Jakarta Sans'];
const fontOffenders = [];
for (const f of [...files, 'index.html']) {
  let body = '';
  try { body = readFileSync(f, 'utf8'); } catch { continue; }
  for (const face of OLD_FACES) {
    // A mention inside a comment is fine; a font-family declaration is not.
    const re = new RegExp(`font-?[fF]amily[^;\\n]*${face}`);
    if (re.test(body)) fontOffenders.push(`${face} in ${f}`);
  }
}
check('no font-family still names a retired typeface',
      fontOffenders.length === 0, fontOffenders.slice(0, 5).join('; '));

// Fonts must be self-hosted: this ships in a Capacitor wrapper where a
// CDN fetch is a round trip on first paint and fails offline.
const html = readFileSync('index.html', 'utf8');
check('no CDN font links (fonts are self-hosted)',
      !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html));

const mainJsx = readFileSync('src/main.jsx', 'utf8');
for (const pkg of ['manrope', 'bricolage-grotesque', 'jetbrains-mono', 'noto-sans-telugu']) {
  check(`${pkg} imported in main.jsx`, mainJsx.includes(pkg));
}

// ── 6. brand colors preserved ───────────────────────────────────────
const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
check('WhatsApp green preserved', /#25[dD]366/.test(all));
check('Google blue preserved',    /#4285[fF]4/.test(all));

console.log('\n' + [...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
