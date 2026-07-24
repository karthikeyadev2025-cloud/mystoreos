-- ═══════════════════════════════════════════════════════════════════════
-- Multi-device tracking for distributors — "Multi-device" has been a
-- defined number in pricing metadata (1/3/10 devices per tier) since
-- the beginning, but nothing ever counted or limited concurrent
-- logins. This adds real, lightweight tracking.
--
-- Deliberately a SOFT WARNING, not a hard block. Unlike the shop-limit
-- fix (a discrete, intentional action — linking a shop — safe to
-- block outright), device/session counting is inherently fuzzier:
-- browser cache clears, multiple tabs, shared computers, and phone/
-- desktop switching can all create false positives. A hard block here
-- risks locking out a legitimate paying distributor over a technical
-- quirk, which is a worse outcome than under-enforcing this one limit.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.device_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id      text NOT NULL,     -- a random id generated client-side and persisted in localStorage, not a hardware fingerprint
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributor_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_distributor ON public.device_sessions(distributor_id, last_seen_at);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_sessions_own" ON public.device_sessions;
CREATE POLICY "device_sessions_own" ON public.device_sessions FOR ALL
  USING (distributor_id = public.current_profile_id())
  WITH CHECK (distributor_id = public.current_profile_id());

SELECT 'device_sessions table installed' AS status;
