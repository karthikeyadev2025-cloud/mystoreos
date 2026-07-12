-- ═══════════════════════════════════════════════════════════════════════
-- Flag home-visit bookings in the in-app notification.
--
-- A shop owner glancing at the notification bell (not the WhatsApp
-- alert, which already got a 🏠 tag in the same feature commit) had no
-- way to tell a home-visit booking apart from a normal in-shop one
-- without opening it — the title/body never mentioned location. Given
-- staff need to know whether to prep a chair or pack a kit and head out,
-- this needs to be visible at a glance.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_appointment_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'booking',
      CASE WHEN NEW.service_location = 'at_home' THEN '🏠 Home visit booked · ' ELSE 'New booking · ' END
        || COALESCE(NEW.customer_name, 'Guest'),
      to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM')
        || ' · ' || COALESCE(NEW.service_name, 'Service')
        || CASE WHEN NEW.service_location = 'at_home' THEN ' · ' || COALESCE(NEW.customer_address, '') ELSE '' END,
      '/shop?tab=bookings&appointment=' || NEW.id::text,
      jsonb_build_object('appointment_id', NEW.id, 'service', NEW.service_name, 'price', NEW.service_price, 'location', NEW.service_location)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'cancelled' THEN
      -- Someone cancelled — always tell the shop.
      PERFORM public.push_notification(
        NEW.shop_id, 'booking',
        'Booking cancelled · ' || COALESCE(NEW.customer_name, 'Guest'),
        to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM'),
        '/shop?tab=bookings',
        jsonb_build_object('appointment_id', NEW.id)
      );
    ELSIF NEW.status = 'confirmed' THEN
      -- Try to notify the customer if we can find them by phone.
      SELECT id INTO v_customer_uuid FROM public.users
        WHERE phone = NEW.customer_phone AND role = 'customer' LIMIT 1;
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Booking confirmed',
          'Your appointment on ' || to_char(NEW.appointment_date, 'DD Mon') ||
          ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM') || ' is confirmed.',
          NULL,
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'appointment notifications now flag home-visit bookings' AS status;
