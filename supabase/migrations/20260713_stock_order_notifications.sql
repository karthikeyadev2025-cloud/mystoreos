-- ═══════════════════════════════════════════════════════════════════════
-- STOCK ORDER NOTIFICATIONS — distributor ↔ shop, never wired up at all.
--
-- Unlike orders and appointments (which both had a notification trigger,
-- just with the accept-only-not-reject asymmetry already fixed today),
-- stock_orders had ZERO notification trigger of any kind. A shop placing
-- a stock order with a distributor, and the distributor accepting or
-- rejecting it, produced no automatic notification in either direction —
-- not even a WhatsApp fallback (checked; the only WhatsApp link in the
-- distributor dashboard is for collections visits, unrelated).
--
-- Two events:
--   INSERT              -> notify the distributor (if the order names
--                           one — distributor_id can be NULL for an
--                           unassigned/broadcast order, in which case
--                           there's no single recipient and we skip)
--   UPDATE status change -> notify the shop, for BOTH 'accepted' and
--                           'rejected' (status here is genuinely
--                           distinct, unlike orders' overloaded
--                           'Cancelled' — no ownership-check trick
--                           needed to tell directions apart)
-- ═══════════════════════════════════════════════════════════════════════

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
        -- Lets a distributor accept without implying same-day shipment —
        -- see 20260713_stock_order_dispatch.sql. If they've given an
        -- estimate, the shop should see it instead of assuming it ships
        -- immediately.
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
      -- The actual "it's on a vehicle now" moment — distinct from
      -- acceptance, which only means the distributor committed to
      -- fulfil it. This is the notification a shop actually wants: not
      -- "we agreed to send it" but "it's on its way."
      PERFORM public.push_notification(
        NEW.shop_id, 'order',
        '📦 Stock order dispatched',
        'Your order of ₹' || COALESCE(NEW.total::text, '0') || ' has been dispatched and is on its way.',
        '/shop?tab=stock-orders&order=' || NEW.id::text,
        jsonb_build_object('stock_order_id', NEW.id, 'total', NEW.total)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_stock_orders ON public.stock_orders;
CREATE TRIGGER notify_stock_orders
  AFTER INSERT OR UPDATE OF status ON public.stock_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_stock_order_events();

-- stock_orders wasn't in the realtime publication either — meaning even
-- if a notification row got created, the distributor's/shop's dashboard
-- wouldn't have picked it up live without a manual refresh. Same
-- instant-update treatment orders/appointments/credits already got.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_orders;
  END IF;
END $$;

SELECT 'stock_orders now has real notifications (new order -> distributor, accept/reject -> shop) and realtime updates — neither existed before' AS status;
