// Smoke tests for pages any visitor can reach without logging in.
// These would have caught, in order:
//   - The TDZ crash on ShopDashboard mount (via any dashboard route
//     redirect that briefly mounts the crashing chunk)
//   - The 'isPureServiceShop' TDZ crash on every service storefront
//   - The registration retailer/service split silently disappearing
//   - Login form not rendering / auth-login edge function hard down
//
// All against real production. If any of these fail, the site is
// visibly broken to a random passerby.

import { test, expect } from '@playwright/test';
import { watchForErrors, expectNoErrors } from './_helpers.js';

test.describe('Public pages render without JS errors', () => {
  test('landing page loads', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    // Landing has a hero — check something visible actually painted, not
    // just that HTML shell loaded. If React crashed at mount, this fails.
    await expect(page.locator('body')).toContainText(/mystore/i, { timeout: 10_000 });
    expectNoErrors(errors);
  });

  test('login page renders form', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/login');
    await expect(page.locator('input[placeholder*="mobile" i]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[placeholder*="password" i], input[placeholder*="PIN" i]').first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('register page shows role and (for shops) retailer/service split', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/register');
    // Was matching /business/i and /customer/i loosely. /business/i
    // also matched the nested "📅 Service Business I sell..." option
    // that appears once "Business" is selected. /customer/i ALSO
    // ambiguously matched the "🛍️ Retailer" option — its own tagline
    // literally reads "I sell products (walk-in customers, POS-first)",
    // so the word "customer" genuinely appears in its full accessible
    // name too. None of this is an app bug — every one of these
    // buttons is legitimately meant to be there; the loose regexes
    // just weren't precise enough once the page had more than one
    // button whose text happened to contain the search word. Using
    // exact accessible names (confirmed directly against real runs)
    // removes the ambiguity for all three.
    await expect(page.getByRole('button', { name: '🏪 Business', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '🚚 Distributor', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '🛒 Customer', exact: true })).toBeVisible();

    // Click "Business" and confirm retailer/service picker is present —
    // this is the split that lets us route service shops to the right
    // dashboard. If it goes missing, business_kind never gets set at
    // signup and every new shop lands on retail POS.
    await page.getByRole('button', { name: '🏪 Business', exact: true }).click();
    await expect(page.getByText(/retailer/i)).toBeVisible();
    await expect(page.getByText(/service business/i)).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('Public storefronts', () => {
  // These two IDs are real, stable shops. If they get deleted, update.
  // RK JEANS is a RETAIL shop with real products + branches.
  const RETAIL_SHOP = '70db371c-61f5-4340-9dbe-7cdd48172daa';

  test('retail storefront renders products without crashing', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(`/s/${RETAIL_SHOP}`);
    // Storefront must render the shop name and at least one product
    // price. If isPureServiceShop or any similar derivation regresses
    // into a TDZ crash, this fails.
    await expect(page.locator('body')).toContainText(/rk jeans/i, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/₹/, { timeout: 10_000 });
    // NOTE: "Book Appointment" now legitimately appears for any shop
    // (retail or service) with an active service listed - see
    // UserDashboard.jsx loadCatalogue / shopHasServices. Asserting its
    // absence here is no longer a valid invariant for this shop.
    expectNoErrors(errors);
  });

  test('non-existent shop id shows a graceful not-found, not a crash', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/s/00000000-0000-0000-0000-000000000000');
    // We don't care what the "not found" message says, only that the
    // React tree didn't throw. Body must render something.
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 8_000 });
    // Ignorable: 404s / RLS-blocked selects log to console. Real crashes
    // still fail via pageerror.
    expectNoErrors(errors.filter(e => e.startsWith('pageerror:')));
  });
});
