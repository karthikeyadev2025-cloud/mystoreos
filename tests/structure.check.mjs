#!/usr/bin/env node
/**
 * PHASE 0 — STRUCTURAL CHECKS
 *
 * Written because a real bug shipped that had a clean build AND clean
 * lint: intelligence panels rendered on every tab because a fragment
 * closed in the wrong place. Nothing automated caught it; a human
 * looking at the screen did.
 *
 * These checks encode the two structural traps this codebase actually
 * has, so neither can regress silently again:
 *
 *   1. SPLIT RENDER TREES — DistributorDashboard and ShopDashboard each
 *      render desktop and mobile independently. A feature added to one
 *      is invisible to half the users, with nothing failing.
 *
 *   2. TAB SCOPING — anything meant for one tab must sit inside that
 *      tab's condition, or it bleeds onto every other tab.
 *
 * Run: node tests/structure.check.mjs
 */

import { readFileSync } from 'fs';

let failures = 0;
const pass = (m) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const fail = (m) => { failures++; console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`); };

function section(t) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

// ── 1. Features must exist in BOTH render trees ────────────────────
section('Split render trees — feature present in desktop AND mobile');

const dist = readFileSync('src/pages/DistributorDashboard.jsx', 'utf8');
[
  ['🛒 New Sale', 2],
  ['📥 Purchases', 2],
  ['📊 Reports', 2],
  ['Receivables Aging', 2],
  ['Accounts Going Quiet', 2],
  ['Field Distribution', 2],
  ["Couldn&apos;t load your data", 2],
].forEach(([needle, expected]) => {
  const n = dist.split(needle).length - 1;
  n === expected
    ? pass(`${needle} — in ${n} trees`)
    : fail(`${needle} — found ${n}, expected ${expected} (missing from one tree?)`);
});

// ── 2. Dashboard-only content must be tab-scoped ───────────────────
section('Tab scoping — dashboard content must not bleed onto other tabs');

// Desktop: find the fragment that opens right after the first
// activeTab === 'dashboard' and confirm it encloses the panels.
const lines = dist.split('\n');
const fragStart = lines.findIndex(l => l.trim() === '<>');
const fragEnd = lines.findIndex((l, i) => i > fragStart && l.trim() === '</>');

if (fragStart === -1 || fragEnd === -1) {
  fail('could not locate the desktop dashboard fragment');
} else {
  const block = lines.slice(fragStart, fragEnd).join('\n');
  ['New Sale', 'Purchases', 'Reports', 'Receivables Aging', 'Accounts Going Quiet']
    .forEach(label => {
      block.includes(label)
        ? pass(`${label} is inside the dashboard-only block`)
        : fail(`${label} is OUTSIDE the dashboard block — will render on every tab`);
    });
}

// ── 3. Every navigate() target must be a registered route ──────────
section('Navigation — every navigate() target resolves to a real route');

const app = readFileSync('src/App.jsx', 'utf8');
const registered = new Set([...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]));

const files = [
  'src/pages/DistributorDashboard.jsx',
  'src/pages/ShopDashboard.jsx',
  'src/pages/UserDashboard.jsx',
  ...['FieldSetup', 'FieldRoutes', 'FieldRun', 'FieldOrders', 'FieldVanBilling',
      'FieldSettlement', 'FieldReps', 'FieldActivity', 'FieldStock', 'FieldLoadOut',
      'FieldDiagnostics', 'DirectSale', 'Purchases', 'Reports', 'ShopVanHistory']
      .map(f => `src/pages/field/${f}.jsx`),
];

const targets = new Set();
files.forEach(f => {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { return; }
  [...src.matchAll(/navigate\('(\/[^']*)'\)/g)].forEach(m => targets.add(m[1]));
});

[...targets].sort().forEach(t => {
  // A wildcard route covers its children.
  const ok = registered.has(t)
    || [...registered].some(r => r.endsWith('/*') && t.startsWith(r.slice(0, -2)));
  ok ? pass(`${t}`) : fail(`${t} — no matching route in App.jsx`);
});

// ── 4. Money-critical mutations must not use safe() ─────────────────
section('Mutations — writes must surface failure, not swallow it');

const shop = readFileSync('src/pages/ShopDashboard.jsx', 'utf8');
[['ShopDashboard', shop], ['DistributorDashboard', dist]].forEach(([name, src]) => {
  const bad = [...src.matchAll(/safe\(\(\)\s*=>\s*api\.(add|create|update|delete|place|record|pay)\w*/g)];
  bad.length === 0
    ? pass(`${name} — no mutations wrapped in safe()`)
    : fail(`${name} — ${bad.length} mutation(s) use safe(), failures will be silent: ${bad.map(b => b[0]).join(', ')}`);
});

// ── 5. Every RPC the app calls must exist in a migration ───────────
section('RPCs — every .rpc() target is defined in a migration');

import { readdirSync } from 'fs';

const migrationSrc = readdirSync('supabase/migrations')
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(`supabase/migrations/${f}`, 'utf8'))
  .join('\n');

const rpcTargets = new Set();
const scanForRpc = (dir) => {
  readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) return scanForRpc(full);
    if (!/\.(js|jsx)$/.test(e.name)) return;
    [...readFileSync(full, 'utf8').matchAll(/\.rpc\('([a-z_]+)'/g)]
      .forEach(m => rpcTargets.add(m[1]));
  });
};
scanForRpc('src');

[...rpcTargets].sort().forEach(fn => {
  // Migrations declare functions both with and without the public.
  // prefix, so match either — an over-strict pattern here produces
  // false alarms that train people to ignore this check.
  const re = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION\\s+(?:public\\.)?${fn}\\b`);
  re.test(migrationSrc)
    ? pass(`${fn}`)
    : fail(`${fn} — called in app code but no migration defines it (runtime failure)`);
});

// ── 6. Pricing must have exactly ONE source of truth ───────────────
section('Pricing — no hardcoded tier prices outside planCatalogue');

// Prices used to live in SIX independent places. Updating distributor
// pricing missed one, and the billing dashboard served stale figures
// while the landing page showed the new ones — a customer could see two
// different prices for the same plan. This check exists so that can't
// silently return.
const priceFiles = [
  'src/lib/api.js',
  'src/pages/Pricing.jsx',
  'src/pages/LandingPage.jsx',
  'src/pages/admin/TabDistributors.jsx',
];
const knownPrices = [249, 499, 699, 999, 1499, 2499, 3499, 7999];
let hardcoded = 0;
priceFiles.forEach(f => {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { return; }
  src.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    knownPrices.forEach(p => {
      if (new RegExp(`price:\\s*${p}\\b`).test(line)) {
        fail(`${f}:${i + 1} hardcodes price ${p} — use priceOf() instead`);
        hardcoded++;
      }
    });
  });
});
if (hardcoded === 0) pass('all tier prices derive from planCatalogue.js');

// ── 7. Invoice Templates — every template ID has a matching renderer ─────────
section('Invoice Templates — all templates have registered renderers');

const invTemplatesSrc = readFileSync('src/lib/invoiceTemplates.js', 'utf8');
const registeredRenderers = new Set([...invTemplatesSrc.matchAll(/(\w+):\s*render\w+/g)].map(m => m[1]));
['classic', 'wholesale', 'gst_tax', 'minimal', 'modern', 'catalog', 'party_statement'].forEach(t => {
  registeredRenderers.has(t)
    ? pass(`template renderer: ${t}`)
    : fail(`template renderer: ${t} — missing from RENDERERS in invoiceTemplates.js`);
});

console.log(
  failures === 0
    ? '\n\x1b[32m✔ all structural checks passed\x1b[0m\n'
    : `\n\x1b[31m✘ ${failures} structural check(s) failed\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);

