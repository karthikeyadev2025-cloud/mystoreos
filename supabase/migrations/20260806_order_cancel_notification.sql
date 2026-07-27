-- ═══════════════════════════════════════════════════════════════════════
-- CUSTOMER ORDER NOTIFICATIONS — cancellation and completion
--
-- FOUND IN PHASE 3 (customer <-> shop connection testing):
-- notify_order_events() notified the customer on exactly ONE status —
-- 'Accepted'. Every other transition was silent.
--
-- The worst of those is CANCELLATION. A customer whose order is
-- cancelled was never told anything at all: their order simply sat in
-- their history unchanged from their point of view, and they kept
-- waiting for goods that were never coming. Being told an order is
-- cancelled is arguably more important than being told it was
-- accepted — accepted is what you expect, cancelled is what you need
-- to act on.
--
-- Also adds completion, so the loop actually closes rather than going
-- quiet after acceptance.
--
-- Everything else in the function is preserved exactly: the shop's
-- new-order notification on INSERT, and the UUID guard that skips POS
-- walk-in rows whose user_id is a synthetic string rather than a real
-- customer.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_order_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'order',
      'New order received',
      COALESCE(NEW.user_id, 'Walk-in customer') || ' · ' || COALESCE(NEW.status, 'Pending'),
      '/shop?tab=orders&order=' || NEW.id::text,
      jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Only if user_id looks like a UUID (some POS orders use walk-in
    -- strings, which are not real accounts and can't be notified).
    BEGIN v_customer_uuid := NEW.user_id::uuid; EXCEPTION WHEN OTHERS THEN v_customer_uuid := NULL; END;

    IF v_customer_uuid IS NOT NULL THEN
      IF NEW.status = 'Accepted' THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'order',
          'Order accepted',
          'Your order at the shop has been accepted.',
          '/user?tab=orders&order=' || NEW.id::text,
          jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
        );

      -- THE GAP THIS FIXES. Matched case-insensitively because the
      -- status is written from several places in the app and casing
      -- has not been consistent — a notification that silently fails
      -- on 'cancelled' vs 'Cancelled' would be worse than none, since
      -- it would look implemented.
      ELSIF lower(NEW.status) IN ('cancelled', 'canceled', 'rejected') THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'order',
          'Order cancelled',
          'The shop could not fulfil your order. Tap for details, or contact the shop.',
          '/user?tab=orders&order=' || NEW.id::text,
          jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
        );

      ELSIF lower(NEW.status) IN ('completed', 'delivered', 'ready') THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'order',
          CASE WHEN lower(NEW.status) = 'ready' THEN 'Order ready' ELSE 'Order completed' END,
          CASE WHEN lower(NEW.status) = 'ready'
               THEN 'Your order is ready for pickup.'
               ELSE 'Your order is complete. Thank you!' END,
          '/user?tab=orders&order=' || NEW.id::text,
          jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_orders ON public.orders;
CREATE TRIGGER notify_orders
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_events();

SELECT 'Customers are now notified on cancellation and completion, not only acceptance' AS status;
