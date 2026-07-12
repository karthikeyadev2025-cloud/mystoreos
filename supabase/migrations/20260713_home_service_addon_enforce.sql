-- ═══════════════════════════════════════════════════════════════════════
-- Server-side enforcement of the Home Service add-on gate.
--
-- The client-side checks (ServiceBookingWidget hides the option,
-- DesktopBookings' walk-in modal hides it too) are the normal path, but
-- a customer could bypass the widget and call bookAppointment directly
-- with service_location:'at_home', or a shop's staff could construct
-- the walk-in request by hand. Every insert path — customer widget
-- booking, walk-in booking, and each occurrence materialized by a
-- recurring series — ultimately writes into the same appointments
-- table, so a single BEFORE INSERT/UPDATE trigger there closes all of
-- them at once rather than needing separate guards in three places.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._require_home_service_addon() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addon_expires timestamptz;
BEGIN
  IF NEW.service_location = 'at_home' THEN
    SELECT home_service_addon_expires_at INTO addon_expires
      FROM public.users WHERE id = NEW.shop_id;
    IF addon_expires IS NULL OR addon_expires <= now() THEN
      RAISE EXCEPTION 'This shop does not have an active Home Service add-on'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_home_service_addon ON public.appointments;
CREATE TRIGGER require_home_service_addon
  BEFORE INSERT OR UPDATE OF service_location ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public._require_home_service_addon();

SELECT 'home-visit appointments now require an active add-on at the database level, across every insert path' AS status;
