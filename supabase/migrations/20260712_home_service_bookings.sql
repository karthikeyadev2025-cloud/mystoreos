-- ═══════════════════════════════════════════════════════════════════════
-- HOME SERVICE BOOKINGS
--
-- Adds the ability for a shop to offer a service either at their own
-- location, at the customer's home, or both — chosen PER SERVICE (a
-- salon might do haircuts at home but keep facials in-shop only, since
-- that needs equipment). A home visit can carry an extra fee, since
-- travel time/cost is real and shops need a way to price for it.
--
-- New columns:
--   services.home_service_enabled  — can this service be booked at-home?
--   services.home_service_fee      — extra ₹ charged for a home visit
--                                     (0 = no surcharge, still allowed)
--   appointments.service_location  — 'in_shop' | 'at_home', chosen by the
--                                     customer at booking time
--   appointments.customer_address  — required when service_location =
--                                     'at_home', NULL otherwise
--   appointments.home_service_fee  — snapshot of the fee AT BOOKING TIME,
--                                     same reasoning as service_name/
--                                     service_price already being
--                                     denormalised onto appointments: if
--                                     the shop changes the fee later, a
--                                     past booking's price shouldn't
--                                     silently change with it.
--
-- Privacy: customer_address is at least as sensitive as customer_phone,
-- which the 20260705_appointments_privacy_fix.sql migration already
-- locked down to a column-level GRANT for the `anon` role covering only
-- (id, shop_id, appointment_date, appointment_time, duration_minutes,
-- status). This migration does NOT touch that GRANT, so the new columns
-- are private by default — anon (the public booking-slot-check policy)
-- can never see them, only the shop (via appointments_owner_all, which
-- already resolves staff_of correctly) and the customer via their own
-- manage-token RPCs.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS home_service_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_service_fee numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_location text NOT NULL DEFAULT 'in_shop'
    CHECK (service_location IN ('in_shop', 'at_home')),
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS home_service_fee numeric(10,2) NOT NULL DEFAULT 0;

-- Guard: an at-home booking must carry an address; an in-shop booking
-- should not silently carry a stray one from a prior edit. Kept as a
-- CHECK rather than a trigger since it's a simple structural rule with
-- no side effects to coordinate.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_home_address_required;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_home_address_required
  CHECK (
    (service_location = 'at_home' AND customer_address IS NOT NULL AND length(trim(customer_address)) > 0)
    OR (service_location = 'in_shop')
  );

SELECT 'home service booking columns added — services.home_service_enabled/fee, appointments.service_location/customer_address/home_service_fee' AS status;
