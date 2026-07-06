// Tests for the auth boundary. We don't type real passwords in
// Playwright — we set the session in localStorage directly (same shape
// the app writes) and verify the UI honors it. This catches:
//   - Service accounts landing on retail POS at login (8cd3512)
//   - Retail Bookings tab leaking into retail sidebar (ee86abc)
//   - Service sidebar showing Products/Restock/Credit Book (40e9808)
//   - Category matching regressing to case-sensitive (3f54cce)
//
// The sessions used here point at IDs that don't need to authenticate
// against Supabase to show the correct sidebar / tab shape, because
// the entire routing decision is client-side. Any RLS-blocked API
// calls after mount are fine — they'd surface as console noise, not
// UI regressions.

import { test, expect } from '@playwright/test';
import { watchForErrors, expectNoErrors } from './_helpers.js';

async function setSession(page, session) {
  // localStorage isn't accessible before a page load, so navigate to
  // an origin-served page first, then plant the session.
  await page.goto('/login');
  await page.evaluate((s) => {
    localStorage.setItem('mystore_session', JSON.stringify(s));
  }, session);
}

test.describe('Retail shop dashboard shape', () => {
  test('retail sidebar has POS tabs and NO booking/service leakage', async ({ page }) => {
    const errors = watchForErrors(page);
    await setSession(page, {
      id: '70db371c-61f5-4340-9dbe-7cdd48172daa',
      name: 'RK JEANS & MENS WEAR',
      role: 'shop',
      shopCategory: 'General',
      businessKind: null,  // retail
      status: 'active',
      subscription: 'active',
    });
    await page.goto('/shop');

    // Wait for the sidebar to actually render (Products is a retail
    // tab that must be present).
    await expect(page.locator('aside').getByRole('button', { name: /^products$/i })).toBeVisible({ timeout: 10_000 });

    const sidebarText = await page.locator('aside').innerText();

    // Retail must SEE:
    expect(sidebarText).toMatch(/POS \/ Home/);
    expect(sidebarText).toMatch(/Products/);
    expect(sidebarText).toMatch(/Restock/);
    expect(sidebarText).toMatch(/Credit Book/);

    // Retail must NOT see service tabs:
    expect(sidebarText).not.toMatch(/^Bookings$/m);
    expect(sidebarText).not.toMatch(/^Services$/m);
    expect(sidebarText).not.toMatch(/^Staff$/m);
    expect(sidebarText).not.toMatch(/^Dashboard$/m); // service-only

    expectNoErrors(errors);
  });

  test('retail POS home has Quick Shelf Explorer + retail KPIs', async ({ page }) => {
    const errors = watchForErrors(page);
    await setSession(page, {
      id: '70db371c-61f5-4340-9dbe-7cdd48172daa',
      name: 'RK JEANS & MENS WEAR',
      role: 'shop',
      shopCategory: 'General',
      businessKind: null,
      status: 'active',
      subscription: 'active',
    });
    await page.goto('/shop');

    // Retail KPIs must be present on POS home — hiding these would mean
    // I regressed the service-vs-retail gating and pulled retail tiles
    // for retail users too.
    await expect(page.locator('body')).toContainText('New Orders', { timeout: 10_000 });
    await expect(page.locator('body')).toContainText('Total Products');
    await expect(page.locator('body')).toContainText('Supplier Credit');
    // Service-only tiles must NOT appear:
    await expect(page.locator('body')).not.toContainText('Manage Bookings');

    expectNoErrors(errors);
  });
});

test.describe('Service shop dashboard shape', () => {
  // Any UUID works for shape testing; RLS will 401 the data fetches but
  // that's console noise, not a UI regression. The sidebar/tab shape is
  // pure client-side derivation from the session's shopCategory/kind.
  const anyServiceSession = {
    id: '00000000-0000-4000-a000-000000000042',
    name: 'Test Salon (Playwright)',
    role: 'shop',
    shopCategory: 'Salon',        // Note: capital S — was the 3f54cce bug
    businessKind: 'service',
    status: 'active',
    subscription: 'active',
  };

  test('service sidebar promotes Bookings/Services/Staff, hides retail-only', async ({ page }) => {
    const errors = watchForErrors(page);
    await setSession(page, anyServiceSession);
    await page.goto('/shop');

    // Wait until the service Dashboard tab has rendered.
    await expect(page.locator('aside').getByRole('button', { name: /^dashboard$/i })).toBeVisible({ timeout: 10_000 });

    const sidebarText = await page.locator('aside').innerText();

    // Service MUST see:
    expect(sidebarText).toMatch(/Dashboard/);
    expect(sidebarText).toMatch(/Bookings/);
    expect(sidebarText).toMatch(/Services/);
    expect(sidebarText).toMatch(/Staff/);

    // Service must NOT see retail-only:
    expect(sidebarText).not.toMatch(/^Products$/m);
    expect(sidebarText).not.toMatch(/^Restock$/m);
    expect(sidebarText).not.toMatch(/^Credit Book$/m);
    // Errors from RLS-blocked fetches are console warnings, not fatal.
    // We only care that the client didn't throw.
    for (const e of errors) {
      // Allow supabase 401 / RLS noise, fail on TDZ / render crashes.
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Real render error slipped through: ${e}`);
      }
    }
  });

  test('case-insensitive category still resolves service correctly ("Spa")', async ({ page }) => {
    const errors = watchForErrors(page);
    // This is the exact shape that caused karthikeya spa to land on
    // retail POS. If the case-insensitive matcher regresses to exact
    // lowercase, Dashboard won't appear in the sidebar.
    await setSession(page, {
      ...anyServiceSession,
      businessKind: null,          // no explicit kind — force fallback
      shopCategory: 'Spa',         // capital S — the exact 3f54cce case
    });
    await page.goto('/shop');
    await expect(page.locator('aside').getByRole('button', { name: /^dashboard$/i })).toBeVisible({ timeout: 10_000 });
    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Real render error slipped through: ${e}`);
      }
    }
  });
});
