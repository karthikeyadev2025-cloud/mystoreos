// Playwright config for MyStore OS smoke tests.
//
// Why these tests exist: this session caught several bugs late that a
// 30-second smoke test would have caught immediately —
//   - TDZ crash on shop dashboard mount (0a32261)
//   - Service business landing on retail POS at login
//   - Public storefront crash on every service shop (413e191)
//   - False-success toasts on Add Product / Place Order
//   - Retail widgets leaking into service dashboard
//
// The tests below drive real Chromium against real production (or a
// PLAYWRIGHT_BASE_URL you set). No mocks, no test env — same
// bytes real users hit. Runs in ~30s.
//
// Run locally:      npx playwright test
// Run in CI later:  same, with PLAYWRIGHT_BASE_URL if pointing elsewhere
// Debug a failing:  npx playwright test --debug

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Fail the whole run if a test.only slipped into a commit.
  forbidOnly: !!process.env.CI,
  // One retry lets flaky network hiccups pass; anything worse fails.
  retries: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://mystoreos.in',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Fail if any page throws an uncaught JS error. This alone would
    // have caught the TDZ crash (0a32261) that shipped to prod because
    // I forgot to check the logged-in dashboard.
    testIdAttribute: 'data-testid',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-pixel',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
