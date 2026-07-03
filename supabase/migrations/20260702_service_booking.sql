-- ─────────────────────────────────────────────────────────────────────────
-- Service Booking Module
-- Adds two tables: services (shop's catalogue) and appointments (bookings)
-- ─────────────────────────────────────────────────────────────────────────

-- Services catalogue (what the shop offers)
CREATE TABLE IF NOT EXISTS public.services (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id           UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  description       TEXT,
  category          TEXT    NOT NULL DEFAULT 'general',
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url         TEXT,
  active            BOOLEAN NOT NULL DEFAULT true,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments (bookings by customers)
CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id           UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id        UUID    REFERENCES public.services(id) ON DELETE SET NULL,
  service_name      TEXT    NOT NULL,  -- denormalised so we keep history if service deleted
  service_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  customer_name     TEXT    NOT NULL,
  customer_phone    TEXT    NOT NULL,
  appointment_date  DATE    NOT NULL,
  appointment_time  TIME    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'pending',
  -- pending → confirmed → completed | cancelled
  notes             TEXT,
  staff_notes       TEXT,   -- internal note from shop
  order_id          UUID    REFERENCES public.orders(id) ON DELETE SET NULL,
  -- linked bill generated on completion
  booked_via        TEXT    DEFAULT 'consumer_portal', -- consumer_portal | walk_in | phone
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Services: shop owner can manage; anon can read active ones (for booking page)
DROP POLICY IF EXISTS "services_owner_all"   ON public.services;
DROP POLICY IF EXISTS "services_public_read" ON public.services;

CREATE POLICY "services_owner_all" ON public.services
  FOR ALL USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());

CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (active = true);

-- Appointments: shop owner can see/manage all their appointments
--   Customers can INSERT (book) without an account (anon allowed)
DROP POLICY IF EXISTS "appointments_owner_all"    ON public.appointments;
DROP POLICY IF EXISTS "appointments_public_insert" ON public.appointments;

CREATE POLICY "appointments_owner_all" ON public.appointments
  FOR ALL USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());

CREATE POLICY "appointments_public_insert" ON public.appointments
  FOR INSERT WITH CHECK (true); -- anyone can book an appointment

-- Allow consumer portal users to see their OWN appointments (by phone)
CREATE POLICY "appointments_customer_select" ON public.appointments
  FOR SELECT USING (true); -- filter by phone in app layer

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_shop     ON public.services(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_shop ON public.appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(shop_id, appointment_date);

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT SELECT ON public.services TO anon;
GRANT ALL ON public.services, public.appointments TO authenticated;

SELECT 'Service booking tables created successfully' AS status;
