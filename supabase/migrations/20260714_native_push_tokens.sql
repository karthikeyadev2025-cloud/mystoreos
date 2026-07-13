-- ═══════════════════════════════════════════════════════════════════════
-- Enable native (FCM) push tokens in push_subscriptions.
--
-- The table already reserved a client='native' path (see the original
-- comment on this table: "the column reserves the shape for adding
-- native later without a migration") — but keys_p256dh/keys_auth are
-- NOT NULL, and an FCM registration token has no equivalent to Web
-- Push's VAPID p256dh/auth key pair at all. Making them nullable is
-- the one small migration actually needed to store a native token
-- honestly, rather than stuffing meaningless placeholder strings into
-- NOT NULL columns that don't apply to this row's client type.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.push_subscriptions
  ALTER COLUMN keys_p256dh DROP NOT NULL,
  ALTER COLUMN keys_auth DROP NOT NULL;

-- A native row is genuinely just a token in the endpoint column — add a
-- check so a 'web' row (which DOES need real VAPID keys to ever be
-- sendable) can't accidentally be saved with nulls, while 'native' rows
-- correctly can.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_web_needs_keys;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_web_needs_keys
  CHECK (client = 'native' OR (keys_p256dh IS NOT NULL AND keys_auth IS NOT NULL));

SELECT 'push_subscriptions can now store native FCM tokens (client=''native''), web rows still required to have real VAPID keys' AS status;
