-- ═══════════════════════════════════════════════════════════════════════
-- CLOSE THE LOOP: shop confirms delivery received.
--
-- Before this: pending -> accepted -> dispatched, then nothing. The
-- distributor has no way to know the goods actually arrived — the
-- workflow just stopped after dispatch, with no closing confirmation
-- in either direction. Adding the final state: the SHOP marks an order
-- 'delivered' once it physically arrives, and the DISTRIBUTOR gets
-- notified — completing the loop that started when the shop placed the
-- order in the first place.
--
-- No new RLS work needed: stock_orders_update_shop already allows a
-- shop to update their own order rows via owns_shop(shop_id) — already
-- fixed for staff sessions in an earlier migration this session — with
-- no restriction on which status values they can set. And status is a
-- free-text column, no CHECK constraint to extend.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_stock_order_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.distributor_id IS NOT NULL THEN
      PERFORM public.push_notification(
        NEW.distributor_id, 'order',
        'New stock order · ' || COALESCE(NEW.shop_name, 'Shop'),
        '₹' || COALESCE(NEW.total::text, '0') || ' · ' || COALESCE(jsonb_array_length(NEW.items::jsonb)::text, '0') || ' items',
        '/distributor?tab=orders&order=' || NEW.id::text,
        jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
      );
    END IF;

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'accepted' THEN
      PERFORM public.push_notification(
        NEW.shop_id, 'order',
        '✅ Stock order accepted',
        'Your order of ₹' || COALESCE(NEW.total::text, '0') || ' was accepted by the distributor.'
        || CASE WHEN NEW.expected_dispatch_date IS NOT NULL
             THEN ' Expected dispatch: ' || to_char(NEW.expected_dispatch_date, 'DD Mon YYYY') || '.'
             ELSE '' END,
        '/shop?tab=stock-orders&order=' || NEW.id::text,
        jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.push_notification(
        NEW.shop_id, 'order',
        '❌ Stock order rejected',
        'Your order of ₹' || COALESCE(NEW.total::text, '0') || ' was rejected by the distributor.',
        '/shop?tab=stock-orders&order=' || NEW.id::text,
        jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
      );
    ELSIF NEW.status = 'dispatched' THEN
      PERFORM public.push_notification(
        NEW.shop_id, 'order',
        '📦 Stock order dispatched',
        'Your order of ₹' || COALESCE(NEW.total::text, '0') || ' has been dispatched and is on its way.',
        '/shop?tab=stock-orders&order=' || NEW.id::text,
        jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
      );
    ELSIF NEW.status = 'delivered' THEN
      -- The closing confirmation — tell the distributor the shop
      -- actually received what was sent. Only meaningful notification
      -- target here is the distributor (if the order names one); the
      -- shop is the one who just took this action, they don't need to
      -- be told about their own confirmation.
      IF NEW.distributor_id IS NOT NULL THEN
        PERFORM public.push_notification(
          NEW.distributor_id, 'order',
          '✅ Delivery confirmed · ' || COALESCE(NEW.shop_name, 'Shop'),
          'Your delivery of ₹' || COALESCE(NEW.total::text, '0') || ' was confirmed received.',
          '/distributor?tab=orders&order=' || NEW.id::text,
          jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'stock order workflow now closes the loop — delivered confirmation notifies the distributor' AS status;
