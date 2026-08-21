#!/usr/bin/env node
/**
 * theme-literals — rebrand the places theme-codemod deliberately skipped.
 *
 *   node scripts/theme-literals.mjs --dry     report only (default)
 *   node scripts/theme-literals.mjs --write   apply
 *
 * theme-codemod left literal hex in SVG attributes, canvas, jsPDF, the
 * print/thermal templates and the native StatusBar calls, because
 * var(--token) does not resolve in any of them. Those places still need
 * the new palette — they just need it as a literal value.
 *
 * This runs over exactly those files and swaps old palette hex for new.
 * Same mapping as the token file, resolved to values.
 *
 * ONE THING TO KNOW ABOUT THERMAL RECEIPTS: 58mm thermal paper is
 * monochrome. Color in thermalReceipt.js only affects the on-screen
 * preview — the printer renders everything as black dots. The values are
 * updated for the preview's sake; they change nothing on paper.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const WRITE = process.argv.includes('--write');

/* old hex -> new hex, resolved from src/styles/tokens.css */
const MAP = {
  // neutrals
  '#0f172a': '#0B1F33', '#0F172A': '#0B1F33',
  '#1e293b': '#0B1F33', '#1E293B': '#0B1F33',
  '#334155': '#33414F', '#475569': '#33414F',
  '#64748b': '#5A6672', '#94a3b8': '#8B96A2',
  '#cbd5e1': '#C3BBAB', '#e2e8f0': '#D9D3C7', '#E2E8F0': '#D9D3C7',
  '#eef0f3': '#EFECE5', '#EEF0F3': '#EFECE5',
  '#f1f5f9': '#EFECE5', '#F1F5F9': '#EFECE5',
  '#f8fafc': '#F7F5F0', '#F8FAFC': '#F7F5F0',
  '#030712': '#0B1F33',

  // brand
  '#4f46e5': '#12457A', '#4F46E5': '#12457A',
  '#4338ca': '#0D3560', '#4338CA': '#0D3560',
  '#818cf8': '#4A7CAD', '#818CF8': '#4A7CAD',
  '#6366f1': '#4A7CAD', '#6366F1': '#4A7CAD',
  '#eef2ff': '#E8EFF6', '#EEF2FF': '#E8EFF6',
  '#c7d2fe': '#B9CEE2', '#C7D2FE': '#B9CEE2',
  '#f43f5e': '#12457A', '#F43F5E': '#12457A',
  '#7c3aed': '#12457A', '#7C3AED': '#12457A',
  '#8b5cf6': '#4A7CAD', '#8B5CF6': '#4A7CAD',

  // semantic
  '#10b981': '#22C55E', '#10B981': '#22C55E',
  '#059669': '#15803D', '#16a34a': '#15803D',
  '#f59e0b': '#E9A72C', '#F59E0B': '#E9A72C',
  '#d97706': '#D0901A', '#D97706': '#D0901A',
  '#b45309': '#92610A', '#B45309': '#92610A',
  '#ef4444': '#C2382B', '#EF4444': '#C2382B',
  '#dc2626': '#9B2C22', '#DC2626': '#9B2C22',
};

/* Only these files. Everything else was handled by theme-codemod. */
const FILES = [
  'src/lib/invoiceTemplates.js',
  'src/lib/thermalReceipt.js',
  'src/lib/pdfGenerator.js',
  'src/lib/invoicePrint.js',
  'src/lib/native.js',
  'src/lib/capacitorInit.js',
  'src/lib/siteConfig.jsx',
  'src/lib/distributorInsights.js',
  'src/components/DesktopMembership.jsx',
  'src/components/DesktopExpenses.jsx',
  'src/App.jsx',
  'src/pages/admin/TabRevenue.jsx',
  'src/pages/admin/TabUsers.jsx',
  'src/pages/admin/TabAnalytics.jsx',
  'src/pages/admin/TabSupport.jsx',
];

let total = 0;
for (const f of FILES) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { console.log(`  (missing) ${f}`); continue; }

  let n = 0;
  const out = src.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const next = MAP[hex] || MAP[hex.toLowerCase()];
    if (!next || next === hex) return hex;
    n++; return next;
  });

  if (n) {
    total += n;
    console.log(`  ${String(n).padStart(4)}  ${f}`);
    if (WRITE) writeFileSync(f, out);
  }
}

console.log(WRITE ? `\nAPPLIED — ${total} literals rebranded`
                  : `\nDRY RUN — ${total} literals would change (use --write)`);
