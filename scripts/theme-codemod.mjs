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
];

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
