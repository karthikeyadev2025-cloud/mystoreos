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
  test('retail sidebar has POS tabs and NO booking/service leakage', async ({ page }, testInfo) => {
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

    // Desktop renders a real <aside> sidebar. Mobile has no <aside> at
    // all by design — it uses a bottom nav bar instead (confirmed by
    // reading the actual component: DesktopSidebar.jsx's <aside> is
    // only ever mounted when !isMobile). This was the actual cause of
    // every dashboard-shape test failing on mobile-pixel: the test
    // assumed <aside> existed on both platforms, which was never true.
    // Checking the whole page body works correctly on both — the
    // assertions below are about whether given TEXT is reachable
    // anywhere in the current view, which the bottom nav satisfies
    // just as validly as a sidebar does.
    const isMobile = testInfo.project.name === 'mobile-pixel';
    const scope = isMobile ? page.locator('body') : page.locator('aside');

    if (isMobile) {
      await expect(page.getByRole('button', { name: /^products$/i })).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(scope.getByRole('button', { name: /^products$/i })).toBeVisible({ timeout: 10_000 });
    }

    const sidebarText = await scope.innerText();

    // Retail must SEE:
    expect(sidebarText).toMatch(isMobile ? /Home/ : /POS \/ Home/);
    expect(sidebarText).toMatch(/Products/);
    expect(sidebarText).toMatch(/Restock/);
    expect(sidebarText).toMatch(/Credit/);

    // Retail must NOT see service tabs:
    expect(sidebarText).not.toMatch(/^Bookings$/m);
    expect(sidebarText).not.toMatch(/^Services$/m);
    expect(sidebarText).not.toMatch(/^Staff$/m);
    if (!isMobile) expect(sidebarText).not.toMatch(/^Dashboard$/m); // service-only (mobile's "Home" label makes this check meaningless there)

    expectNoErrors(errors);
  });

  test('retail POS home has Quick Shelf Explorer + retail KPIs', async ({ page }, testInfo) => {
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

    // Desktop and mobile genuinely show different retail home screens
    // — confirmed via real runs against both, not assumed. Desktop has
    // a full KPI tile section (New Orders / Today's Sales / Total
    // Products / Supplier Credit) plus "Quick Shelf Explorer" above
    // the POS terminal; mobile shows a simpler, KPI-free POS-first
    // screen. Original assertions checked 'New Orders' / 'Total
    // Products' / 'Supplier Credit' with no platform branching at
    // all — correct for desktop, but those exact tiles don't exist on
    // mobile's version of this screen, which is why this always
    // failed there. Also note the exact casing genuinely differs:
    // desktop shows "POS Terminal", mobile shows "POS TERMINAL".
    const isMobile = testInfo.project.name === 'mobile-pixel';
    if (isMobile) {
      await expect(page.locator('body')).toContainText('POS TERMINAL', { timeout: 10_000 });
      await expect(page.locator('body')).toContainText('Products');
    } else {
      await expect(page.locator('body')).toContainText('New Orders', { timeout: 10_000 });
      await expect(page.locator('body')).toContainText('Total Products');
      await expect(page.locator('body')).toContainText('Supplier Credit');
      await expect(page.locator('body')).toContainText('Quick Shelf Explorer');
    }
    // Service-only tiles must NOT appear on either platform:
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

  test('service sidebar promotes Bookings/Services/Staff, hides retail-only', async ({ page }, testInfo) => {
    const errors = watchForErrors(page);
    await setSession(page, anyServiceSession);
    await page.goto('/shop');

    const isMobile = testInfo.project.name === 'mobile-pixel';
    const scope = isMobile ? page.locator('body') : page.locator('aside');

    // Wait until the service Dashboard tab has rendered. Mobile shows
    // "Dashboard" as a plain label (no button role change needed —
    // the mobile bottom nav item for service businesses is a real
    // <button> too, same as desktop's sidebar).
    await expect(page.getByRole('button', { name: /^dashboard$/i }).first()).toBeVisible({ timeout: 10_000 });

    const sidebarText = await scope.innerText();

    // Service MUST see:
    expect(sidebarText).toMatch(/Dashboard/);
    expect(sidebarText).toMatch(/Bookings/);
    // Services/Staff live inside the Bookings screen's own internal
    // tab switcher on mobile (no separate bottom-nav icon for them —
    // confirmed this is real, working navigation, not a gap, earlier
    // this session), so they're correctly absent from the mobile
    // bottom nav itself. Only check for them on desktop, where they
    // ARE separate sidebar entries.
    if (!isMobile) {
      expect(sidebarText).toMatch(/Services/);
      expect(sidebarText).toMatch(/Staff/);
    }

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
    // Works identically on both platforms — Dashboard is a real
    // <button> on both the desktop sidebar and the mobile bottom nav,
    // so no aside-specific scoping is needed for this one at all.
    await expect(page.getByRole('button', { name: /^dashboard$/i }).first()).toBeVisible({ timeout: 10_000 });
    for (const e of errors) {
      if (/Cannot access|is not defined|is not a function/.test(e)) {
        throw new Error(`Real render error slipped through: ${e}`);
      }
    }
  });
});
