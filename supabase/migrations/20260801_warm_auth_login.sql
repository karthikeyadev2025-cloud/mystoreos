-- ═══════════════════════════════════════════════════════════════════════
-- KEEP THE LOGIN FUNCTION WARM
--
-- Users were hitting "The server is taking longer than usual to wake
-- up. Please tap Sign In once more." on the login screen.
--
-- CAUSE: auth-login imports npm:bcryptjs. On a cold start Deno has to
-- fetch and transpile that package before the function can respond,
-- which can exceed the client's timeout. Anyone logging in after a
-- quiet period paid that cost — including a client opening the app for
-- a first demo, which is the worst possible moment for it.
--
-- TWO-LAYER FIX:
--   1. The login PAGE now pings the function on mount (api.warmLogin),
--      so it warms while the user types their number and password.
--      This handles the normal case and needs no infrastructure.
--   2. This cron is the backstop for cases where layer 1 doesn't get
--      enough lead time — someone landing on a deep link, or typing
--      unusually fast.
--
-- The ping short-circuits before any env reads, client construction or
-- database access, so each run is near-instant and does no real work.
-- Its only job is keeping the isolate resident in memory.
--
-- Every 5 minutes: Supabase keeps an idle isolate alive for roughly
-- 10-15 minutes, so 5 leaves comfortable margin without being wasteful.
--
-- Replace <CRON_SECRET> with the same secret already set via
-- `supabase secrets set CRON_SECRET=...`
-- ═══════════════════════════════════════════════════════════════════════

-- Remove any previous version of this job before re-creating it, so
-- running this file twice doesn't leave two jobs pinging in parallel.
SELECT cron.unschedule('warm-auth-login')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-auth-login');

SELECT cron.schedule(
  'warm-auth-login',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://zdertmpzervgjicuwsfz.functions.supabase.co/auth-login',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('ping', true)
    )
  $$
);

SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'warm-auth-login';
