-- ═══════════════════════════════════════════════════════════════════════
-- Same gap as orders, just found for bookings: the shop rejecting a
-- customer's appointment never notified the customer at all.
--
-- notify_appointment_events()'s 'cancelled' branch always notified the
-- SHOP ('Someone cancelled — always tell the shop'), which is correct
-- when the CUSTOMER cancels via their own manage-token link, but wrong
-- when the SHOP is the one declining a pending booking request — in
-- that direction, the customer needs to know, not the shop (who already
-- knows, they just did it).
--
-- Both directions reach the exact same status transition (-> 'cancelled'),
-- so the trigger needs to tell WHO did it. Distinguishing signal:
-- owns_shop(NEW.shop_id) — true when the update ran under the shop
-- owner's or their staff's own session (e.g. clicking Cancel in
-- DesktopBookings, which calls updateAppointmentStatus as a normal
-- authenticated request). False/anon when it ran through the customer's
-- manage-token RPC (cancel_appointment_by_token is SECURITY DEFINER,
-- callable by anon — a guest customer using their link has no shop
-- session at all, and even a logged-in customer's own session would
-- never satisfy owns_shop for a shop they don't own).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_appointment_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'booking',
      'New booking · ' || COALESCE(NEW.customer_name, 'Guest'),
      to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM')
        || ' · ' || COALESCE(NEW.service_name, 'Service'),
      '/shop?tab=bookings&appointment=' || NEW.id::text,
      jsonb_build_object('appointment_id', NEW.id, 'service', NEW.service_name, 'price', NEW.service_price)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'cancelled' THEN
      IF public.owns_shop(NEW.shop_id) THEN
        -- The SHOP declined/cancelled this booking — the customer needs
        -- to know. Look them up by phone the same way the 'confirmed'
        -- branch already does below.
        SELECT id INTO v_customer_uuid FROM public.users
          WHERE phone = NEW.customer_phone AND role = 'customer' LIMIT 1;
        IF v_customer_uuid IS NOT NULL THEN
          PERFORM public.push_notification(
            v_customer_uuid, 'booking',
            '❌ Booking cancelled',
            CASE WHEN NEW.staff_notes IS NOT NULL AND length(trim(NEW.staff_notes)) > 0
              THEN NEW.staff_notes
              ELSE 'Your appointment on ' || to_char(NEW.appointment_date, 'DD Mon') ||
                   ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM') || ' was cancelled by the shop.'
            END
            -- Home-visit specific: make it explicit no one is coming,
            -- so a customer waiting at home for a technician/stylist
            -- isn't left wondering whether to keep waiting.
            || CASE WHEN NEW.service_location = 'at_home' THEN ' No one will visit your address for this appointment.' ELSE '' END,
            NULL,
            jsonb_build_object('appointment_id', NEW.id)
          );
        END IF;
      ELSE
        -- The CUSTOMER cancelled via their own manage-token link —
        -- unchanged, original behaviour: tell the shop.
        PERFORM public.push_notification(
          NEW.shop_id, 'booking',
          'Booking cancelled · ' || COALESCE(NEW.customer_name, 'Guest'),
          to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM')
            || CASE WHEN NEW.service_location = 'at_home' THEN ' · Home visit' ELSE '' END,
          '/shop?tab=bookings',
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;
    ELSIF NEW.status = 'confirmed' THEN
      -- Try to notify the customer if we can find them by phone.
      SELECT id INTO v_customer_uuid FROM public.users
        WHERE phone = NEW.customer_phone AND role = 'customer' LIMIT 1;
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Booking confirmed',
          'Your appointment on ' || to_char(NEW.appointment_date, 'DD Mon') ||
          ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM') || ' is confirmed.'
          -- Home-visit specific: remind them someone is coming TO them,
          -- not the other way round — the confirmation should read
          -- differently for 'come to us' vs 'we're coming to you'.
          || CASE WHEN NEW.service_location = 'at_home' AND NEW.customer_address IS NOT NULL
               THEN ' We''ll come to: ' || NEW.customer_address
               ELSE '' END,
          NULL,
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'customer now notified when the shop cancels their booking, same as when the shop confirms it' AS status;
