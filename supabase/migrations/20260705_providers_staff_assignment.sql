-- ─────────────────────────────────────────────────────────────────────────
-- Staff assignment + working hours
--
-- DESIGN DECISION: "providers" (bookable staff members) are deliberately
-- a SEPARATE, lighter-weight concept from login-based staff accounts
-- (public.users where role='staff', which require phone+password+PIN).
-- Most small salons want to list "Priya — Hair Stylist" as someone
-- customers can book with, without needing to issue her a full POS login.
-- A shop CAN optionally link a provider to a real staff login later if
-- they want that person to manage their own bookings — hence the
-- nullable staff_user_id column — but it is never required.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.providers (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id         UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  staff_user_id   UUID    REFERENCES public.users(id) ON DELETE SET NULL, -- optional link to a real login
  name            TEXT    NOT NULL,
  title           TEXT,                          -- e.g. "Senior Stylist", "Massage Therapist"
  photo_url       TEXT,
  phone           TEXT,
  -- Weekly working hours as JSONB: {"mon":{"start":"10:00","end":"19:00"}, "tue":{...}, ...}
  -- A day absent from the object (or explicitly null) means closed that day.
  working_hours   JSONB   NOT NULL DEFAULT '{
    "mon": {"start":"10:00","end":"19:00"},
    "tue": {"start":"10:00","end":"19:00"},
    "wed": {"start":"10:00","end":"19:00"},
    "thu": {"start":"10:00","end":"19:00"},
    "fri": {"start":"10:00","end":"19:00"},
    "sat": {"start":"10:00","end":"19:00"},
    "sun": null
  }'::jsonb,
  active          BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time off / vacation / sick leave — blocks booking for a provider across
-- a date range, regardless of what their normal working_hours say.
CREATE TABLE IF NOT EXISTS public.provider_time_off (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id   UUID    NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  start_date    DATE    NOT NULL,
  end_date      DATE    NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link appointments to a specific provider. Nullable — appointments made
-- before this feature existed, or at shops that never set up providers,
-- simply have no provider assigned and keep working exactly as before.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_time_off  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_owner_all"   ON public.providers;
DROP POLICY IF EXISTS "providers_public_read" ON public.providers;
CREATE POLICY "providers_owner_all" ON public.providers
  FOR ALL USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());
-- Customers browsing the booking widget need to see active providers
-- (name, title, photo) to pick who they want — no PII risk, this is
-- exactly what the shop wants displayed publicly.
CREATE POLICY "providers_public_read" ON public.providers
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "provider_time_off_owner_all" ON public.provider_time_off;
CREATE POLICY "provider_time_off_owner_all" ON public.provider_time_off
  FOR ALL USING (
    provider_id IN (SELECT id FROM public.providers WHERE shop_id = public.current_user_shop_id())
  )
  WITH CHECK (
    provider_id IN (SELECT id FROM public.providers WHERE shop_id = public.current_user_shop_id())
  );
-- Customers need to know when a provider is unavailable (to grey out
-- slots) but this table has zero PII either way (just date ranges).
CREATE POLICY "provider_time_off_public_read" ON public.provider_time_off
  FOR SELECT USING (true);

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT SELECT ON public.providers TO anon;
GRANT SELECT ON public.provider_time_off TO anon;
GRANT ALL ON public.providers, public.provider_time_off TO authenticated;

-- ── Re-scope double-booking prevention for provider-assigned appointments ──
--
-- The original exclusion constraint (20260705_appointment_no_overlap.sql)
-- was scoped PER SHOP, assuming a single-resource business. Now that
-- appointments can have a provider_id, two DIFFERENT providers at the
-- same shop must be allowed to serve two customers at the same time —
-- only the SAME provider should be blocked from double-booking.
--
-- Postgres EXCLUDE constraints can't conditionally switch which column
-- they partition on, so this uses TWO separate partial exclusion
-- constraints instead of one:
--   1. provider_id IS NULL  → still scoped per-shop (old behaviour,
--      for shops that haven't set up providers yet)
--   2. provider_id IS NOT NULL → scoped per-provider (new behaviour)

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_shop
  EXCLUDE USING gist (
    shop_id WITH =,
    time_range WITH &&
  ) WHERE (status <> 'cancelled' AND provider_id IS NULL);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_provider
  EXCLUDE USING gist (
    provider_id WITH =,
    time_range WITH &&
  ) WHERE (status <> 'cancelled' AND provider_id IS NOT NULL);

SELECT 'Staff assignment + working hours + re-scoped conflict prevention added' AS status;
