-- ═══════════════════════════════════════════════════════════════════════
-- APPOINTMENT CANCELLATION — tell the CUSTOMER, not only the shop
--
-- FOUND IN PHASE 4 (service + home booking testing):
-- notify_appointment_events() handled cancellation, but notified only
-- the SHOP. The customer lookup (v_customer_uuid) existed solely inside
-- the 'confirmed' branch — so a customer whose appointment the shop
-- cancelled was never told anything.
--
-- This is worse than the equivalent order bug fixed in Phase 3. An
-- uninformed customer doesn't just wait — they physically travel to the
-- shop for an appointment that no longer exists. For a HOME service
-- they sit at home waiting for someone who is never coming, having
-- possibly taken time off to be there.
--
-- Also makes the status match case-insensitive. The rest of the app
-- writes appointment status from several places and casing has not been
-- consistent; an exact-match check that silently misses 'Cancelled'
-- would look implemented while doing nothing.
--
-- The shop notification is preserved exactly — both sides now get told.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_appointment_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
  v_when text;
BEGIN
  v_when := to_char(NEW.appointment_date, 'DD Mon') || ' at ' ||
            to_char(NEW.appointment_time, 'HH12:MI AM');

  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'booking',
      'New booking · ' || COALESCE(NEW.customer_name, 'Guest'),
      v_when,
      '/shop?tab=bookings',
      jsonb_build_object('appointment_id', NEW.id)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Resolve the customer once, up front, so every branch below can
    -- reach them. Previously this only happened for 'confirmed', which
    -- is precisely why cancellation never reached them.
    SELECT id INTO v_customer_uuid FROM public.users
      WHERE phone = NEW.customer_phone AND role = 'customer' LIMIT 1;

    IF lower(NEW.status) IN ('cancelled', 'canceled') THEN
      -- Shop side — unchanged.
      PERFORM public.push_notification(
        NEW.shop_id, 'booking',
        'Booking cancelled · ' || COALESCE(NEW.customer_name, 'Guest'),
        v_when,
        '/shop?tab=bookings',
        jsonb_build_object('appointment_id', NEW.id)
      );

      -- THE FIX. Without this the customer travels to a cancelled
      -- appointment, or waits at home for a home visit that isn't
      -- coming.
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Booking cancelled',
          'Your appointment on ' || v_when || ' has been cancelled. Please contact the shop to rebook.',
          '/user?tab=bookings',
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;

    ELSIF lower(NEW.status) = 'confirmed' THEN
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Booking confirmed',
          'Your appointment on ' || v_when || ' is confirmed.',
          '/user?tab=bookings',
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;

    ELSIF lower(NEW.status) IN ('completed', 'done') THEN
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Service completed',
          'Thanks for visiting. Your appointment on ' || v_when || ' is complete.',
          '/user?tab=bookings',
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_appointments ON public.appointments;
CREATE TRIGGER notify_appointments
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_events();

SELECT 'Customers are now notified when their appointment is cancelled' AS status;
