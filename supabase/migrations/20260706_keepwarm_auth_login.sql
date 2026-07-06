-- ═══════════════════════════════════════════════════════════════════════
-- KEEP-WARM: ping auth-login every 5 minutes so it rarely cold-starts
-- when a real merchant tries to log in.
--
-- Fixes the "The server is taking longer than usual to wake up" message
-- some users saw on slow mobile connections — that message is the app's
-- (correct, working) fallback after a genuine Edge Function cold start
-- plus a slow network compounded past the 17s retry budget. This doesn't
-- change the app code; it just makes cold starts rare in the first place.
--
-- Cost: a ping every 5 min = ~8,640 invocations/month. auth-login rejects
-- the ping instantly (bad phone/password → ~50ms), so this is free-tier
-- friendly and adds no real load.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Your project ref (from https://zdertmpzervgjicuwsfz.supabase.co) is
-- filled in below. Replace ONLY <YOUR_ANON_KEY> before running —
-- find it at: Supabase Dashboard → Settings → API → "anon public" key.
SELECT cron.schedule(
  'keep-warm-auth-login',
  '*/5 * * * *',   -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://zdertmpzervgjicuwsfz.supabase.co/functions/v1/auth-login',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<YOUR_ANON_KEY>',
      'Authorization', 'Bearer <YOUR_ANON_KEY>'
    ),
    body := jsonb_build_object('phone', '0000000000', 'password', 'keepwarm-ping')
  );
  $$
);

-- To check it's running:
--   SELECT * FROM cron.job WHERE jobname = 'keep-warm-auth-login';
-- To see recent run history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- To remove it later:
--   SELECT cron.unschedule('keep-warm-auth-login');

SELECT 'keep-warm cron scheduled for auth-login' AS status;
