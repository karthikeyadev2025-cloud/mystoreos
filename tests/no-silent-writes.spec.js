// Guardrail tests against the false-success-toast bug class.
//
// The bug: safe() was wrapped around mutations, catching all errors and
// returning null, so the caller cheerfully fell through to
// toast.success("Product Saved!") while nothing persisted. Fixed by
// swapping to mustSucceed() (which re-throws) at 20+ call sites.
//
// These tests don't reproduce a save (that needs auth) — they just
// static-scan the source to ensure no one ever wraps a known-mutation
// api.* call in safe() again. Simple, fast, catches the regression at
// PR time.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// api.* methods that ACTUALLY WRITE — if any of these is wrapped in
// safe(), the caller is silently swallowing failures and lying to the
// user via a success toast. If a new mutation method is added to
// api.js, add its name here.
const KNOWN_MUTATIONS = [
  'addProduct',
  'addCredit',
  'markCreditPaid',
  'placeOrder',
  'placeStockOrder',
  'addStaff',
  'updateProfile',
  'saveSiteConfig',
  'setFlashSale',
  'addDistributorProduct',
  'updateStockOrderStatus',
  'deleteProduct',
  'updateProduct',
  'bookAppointment',
  'updateAppointment',
  'deleteAppointment',
];

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('no mutation is wrapped in safe() — use mustSucceed instead', () => {
  const root = path.resolve(process.cwd(), 'src');
  const files = walkJs(root);
  const offenders = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      // Look for `safe(() => api.MUTATION(` — the exact bad pattern
      const m = line.match(/safe\(\(\)\s*=>\s*api\.(\w+)\(/);
      if (!m) return;
      if (KNOWN_MUTATIONS.includes(m[1])) {
        offenders.push(`${path.relative(root, file)}:${i + 1}  api.${m[1]}(...) wrapped in safe() — use mustSucceed`);
      }
    });
  }

  expect(offenders, offenders.length
    ? `\nSilent-write regressions found:\n${offenders.join('\n')}\n\nWrap these in mustSucceed(() => api.X(...), 'label') so the caller's toast tells the truth.`
    : ''
  ).toEqual([]);
});
