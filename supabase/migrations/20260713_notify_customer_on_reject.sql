-- ═══════════════════════════════════════════════════════════════════════
-- Customer was never notified in-app when their order was rejected.
--
-- notify_order_events() only had a branch for NEW.status = 'Accepted'.
-- When a shop declines a pending order (there is no separate 'reject'
-- action in this app — declining a pending order calls the same
-- cancelOrder() that sets status = 'Cancelled'), the customer got:
--   - a WhatsApp message, but ONLY if the shop owner manually completed
--     the wa.me compose-and-send flow (not automatic — a real gap if
--     they're busy or miss it)
--   - ZERO in-app bell notification, no matter what
--
-- The customer's own order-history screen (fixed separately — shows a
-- clear ❌ CANCELLED banner and the shop's reason once they open it) was
-- never proactively surfaced to them. They'd only find out their order
-- was rejected if they happened to check the app on their own.
--
-- Fixed the same way 'Accepted' already was: a customer notification on
-- the transition to 'Cancelled', including the shop's reason
-- (shop_message) when one was given.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_order_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'order',
      'New bill · ₹' || COALESCE(NEW.total::text, '0'),
      COALESCE(NEW.user_id, 'Walk-in customer') || ' · ' || COALESCE(NEW.status, 'Pending'),
      '/shop?tab=bills&order=' || NEW.id::text,
      jsonb_build_object('order_id', NEW.id, 'total', NEW.total, 'status', NEW.status)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Only if user_id looks like a UUID (some POS orders use walk-in
    -- strings like 'walk-in:Name:phone' for guests with no account —
    -- there's nobody to notify in-app for those, which is fine; they
    -- still get the WhatsApp message where a phone number exists).
    BEGIN v_customer_uuid := NEW.user_id::uuid; EXCEPTION WHEN OTHERS THEN v_customer_uuid := NULL; END;

    IF v_customer_uuid IS NOT NULL AND NEW.status = 'Accepted' THEN
      PERFORM public.push_notification(
        v_customer_uuid, 'order',
        'Order accepted',
        'Your order at the shop has been accepted.',
        '/user?tab=orders&order=' || NEW.id::text,
        jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
      );
    ELSIF v_customer_uuid IS NOT NULL AND NEW.status = 'Cancelled' THEN
      PERFORM public.push_notification(
        v_customer_uuid, 'order',
        '❌ Order cancelled',
        CASE WHEN NEW.shop_message IS NOT NULL AND length(trim(NEW.shop_message)) > 0
          THEN NEW.shop_message
          ELSE 'Your order was cancelled by the shop. No payment was taken.'
        END,
        '/user?tab=orders&order=' || NEW.id::text,
        jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'customer now notified in-app on order cancellation, same as on acceptance' AS status;
