// Attach two listeners to every page test uses. Any uncaught JS error
// or console.error fails the test. That's how we catch TDZ crashes,
// bad prop refs, and other silent-in-prod regressions.

import { expect } from '@playwright/test';

export function watchForErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Some third-party warnings are unavoidable (ads, extensions,
      // browser policies). Ignore known-safe ones so tests only fail on
      // MyStore-owned errors. Extend this list carefully.
      const isIgnorable =
        text.includes('[Native] Skipped') ||           // Capacitor no-op
        text.includes('Failed to load resource') ||    // 404s handled elsewhere
        text.includes('favicon');
      if (!isIgnorable) errors.push(`console: ${text}`);
    }
  });
  return errors;
}

// Call at end of test. Passes if zero errors, else prints all of them.
export function expectNoErrors(errors) {
  expect(errors, `Uncaught errors:\n${errors.join('\n')}`).toEqual([]);
}
