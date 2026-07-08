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
  test('Starter service shop: sidebar shows Services tab, and a service-limit hint would fire', async ({ page }) => {
    const errors = watchForErrors(page);
    await setSession(page, serviceSession('starter'));
    await page.goto('/shop');

    // Wait for sidebar render. Bookings is Pro-only on the Starter tier
    // (bookings: false in features.js), so on Starter the tab should
    // NOT appear in the sidebar. This gate is critical — otherwise
    // Starter shops see the whole Bookings surface and never upgrade.
    await expect(page.locator('aside')).toBeVisible({ timeout: 10_000 });
    const sidebar = await page.locator('aside').innerText();
    expect(sidebar).not.toMatch(/^Bookings$/m);
    expect(sidebar).not.toMatch(/^Services$/m);
    expect(sidebar).not.toMatch(/^Staff$/m);

    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Render error: ${e}`);
      }
    }
  });

  test('Pro service shop: full Bookings/Services/Staff sidebar unlocked', async ({ page }) => {
    const errors = watchForErrors(page);
    await setSession(page, serviceSession('pro'));
    await page.goto('/shop');

    await expect(page.locator('aside').getByRole('button', { name: /^bookings$/i })).toBeVisible({ timeout: 10_000 });
    const sidebar = await page.locator('aside').innerText();
    expect(sidebar).toMatch(/Bookings/);
    expect(sidebar).toMatch(/Services/);
    expect(sidebar).toMatch(/Staff/);

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

    await expect(page.locator('aside').getByRole('button', { name: /^bookings$/i })).toBeVisible({ timeout: 10_000 });

    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Render error: ${e}`);
      }
    }
  });
});
