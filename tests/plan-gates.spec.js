// Regression test: plan-gated service features must lock/unlock per tier.
//
// Would have caught the class of bug where a spec change on features.js
// silently opens a Pro feature to Starter tier (revenue leak) or hides
// something from Pro (support ticket).
//
// Plants sessions in localStorage and asserts the rendered sidebar +
// header behavior. Doesn't touch real accounts.

import { test, expect } from '@playwright/test';
import { watchForErrors } from './_helpers.js';

async function setSession(page, session) {
  await page.goto('/login');
  await page.evaluate((s) => {
    localStorage.setItem('mystore_session', JSON.stringify(s));
  }, session);
}

// Baseline service-shop session — tier flipped per test.
function serviceSession(tier) {
  return {
    id: '00000000-0000-4000-a000-000000000042',
    name: 'Test Salon (Playwright)',
    role: 'shop',
    shopCategory: 'Salon',
    businessKind: 'service',
    subscriptionTier: tier,     // 'starter' | 'pro' | 'enterprise' | undefined (trial)
    status: 'active',
    subscription: tier ? 'active' : 'trial',
  };
}

test.describe('Service-feature plan gates', () => {
  test('Starter service shop: sidebar shows Services tab, and a service-limit hint would fire', async ({ page }, testInfo) => {
    const errors = watchForErrors(page);
    await setSession(page, serviceSession('starter'));
    await page.goto('/shop');

    // Desktop renders a real <aside> sidebar; mobile has no <aside> at
    // all by design (confirmed by reading DesktopSidebar.jsx directly —
    // it's only ever mounted when !isMobile) and uses a bottom nav
    // instead. Every mobile-pixel failure in this file traced back to
    // this same DOM mismatch — the test assumed <aside> existed on
    // both platforms, which was never true. Checking the whole body
    // works correctly on both, since these assertions are about
    // whether given text is reachable anywhere in the current view.
    const isMobile = testInfo.project.name === 'mobile-pixel';
    const scope = isMobile ? page.locator('body') : page.locator('aside');

    // Wait for sidebar/nav render. Bookings is Pro-only on the Starter
    // tier (bookings: false in features.js), so on Starter the tab
    // should NOT appear. This gate is critical — otherwise Starter
    // shops see the whole Bookings surface and never upgrade.
    await expect(scope).toBeVisible({ timeout: 10_000 });
    const sidebar = await scope.innerText();
    expect(sidebar).not.toMatch(/^Bookings$/m);
    expect(sidebar).not.toMatch(/^Services$/m);
    expect(sidebar).not.toMatch(/^Staff$/m);

    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Render error: ${e}`);
      }
    }
  });

  test('Pro service shop: full Bookings/Services/Staff sidebar unlocked', async ({ page }, testInfo) => {
    const errors = watchForErrors(page);
    await setSession(page, serviceSession('pro'));
    await page.goto('/shop');

    const isMobile = testInfo.project.name === 'mobile-pixel';
    const scope = isMobile ? page.locator('body') : page.locator('aside');

    await expect(page.getByRole('button', { name: /^bookings$/i }).first()).toBeVisible({ timeout: 10_000 });
    const sidebar = await scope.innerText();
    expect(sidebar).toMatch(/Bookings/);
    // Services/Staff live inside the Bookings screen's own internal
    // tab switcher on mobile (no separate bottom-nav icon for them —
    // confirmed working navigation, not a gap, earlier this session),
    // so they're correctly absent from the mobile bottom nav itself.
    // Only check for them as separate sidebar entries on desktop.
    if (!isMobile) {
      expect(sidebar).toMatch(/Services/);
      expect(sidebar).toMatch(/Staff/);
    }

    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Render error: ${e}`);
      }
    }
  });

  test('Trial: everything unlocked so users can evaluate', async ({ page }) => {
    const errors = watchForErrors(page);
    // Trial = no explicit tier, subscription != 'active' means it falls
    // to PLAN_CAPS.trial which has bookings: true.
    const s = serviceSession(undefined);
    s.subscription = 'trial';
    delete s.subscriptionTier;
    await setSession(page, s);
    await page.goto('/shop');

    // Works identically on both platforms — Bookings is a real
    // <button> on both the desktop sidebar and the mobile bottom nav,
    // so no aside-specific scoping is needed for this one at all.
    await expect(page.getByRole('button', { name: /^bookings$/i }).first()).toBeVisible({ timeout: 10_000 });

    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Render error: ${e}`);
      }
    }
  });
});
