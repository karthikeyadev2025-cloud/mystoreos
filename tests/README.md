# Playwright smoke tests for MyStore OS

These tests exist to catch the specific bug classes that shipped to
production during the July 2026 session, before they can ship again:

1. **`public.spec.js`** — landing / login / register / storefront render
   without JS errors. Would have caught the `isPureServiceShop` TDZ
   crash (`413e191`) that killed every service shop's public page.

2. **`dashboard-shape.spec.js`** — plants a session in localStorage and
   asserts the sidebar / KPI shape matches the shop's `businessKind`.
   Would have caught:
   - service accounts landing on retail POS at login (`8cd3512`)
   - Bookings tab leaking into retail sidebar (`ee86abc`)
   - Products / Restock / Credit Book leaking into service sidebar (`40e9808`)
   - case-sensitive `"Spa" !== "spa"` category matching (`3f54cce`)
   - TDZ crash on shop dashboard mount (`0a32261`) — every logged-in
     dashboard would fail to render `Dashboard` in the sidebar

3. **`no-silent-writes.spec.js`** — static scan. Fails if any known
   mutation is wrapped in `safe()` (which swallows errors and returns
   null, causing false success toasts). Would have caught `96daa1a`
   and `2572461` at PR time.

## Run

    npx playwright test

Runs against production (`https://mystoreos.in`) by default. Point
elsewhere with:

    PLAYWRIGHT_BASE_URL=https://staging.example.com npx playwright test

Runs headless, ~30s. `--headed` to watch. `--debug` to step through.

## What these DON'T cover

- Actual bill placement, booking creation, credit flows — those need
  real credentials and would flip DB state. Add a Playwright fixture
  with a scratch test-shop account when you're ready for that.
- SMS/WhatsApp/Razorpay integrations.
- Anything that requires a physical printer / camera.

Extend by adding a new `*.spec.js` file in this dir.
