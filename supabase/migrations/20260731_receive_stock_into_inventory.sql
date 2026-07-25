-- ═══════════════════════════════════════════════════════════════════════
-- FIX — delivered stock never reached the shop's inventory
--
-- FOUND DURING FULL END-TO-END WORKFLOW TESTING, and it's the biggest
-- functional gap in the whole app:
--
--   A shop orders 100 units from a distributor.
--   The distributor accepts, dispatches.
--   The shop confirms delivery.
--   The shop's product stock: COMPLETELY UNCHANGED.
--
-- Verified exhaustively: no trigger on stock_orders touches products,
-- markStockOrderDelivered() only flips a status, and there is no
-- "receive into inventory" action anywhere in the UI. The shopkeeper
-- has to manually edit every single product's stock number by hand
-- after every delivery — which defeats the point of having inventory
-- management and ordering in the same product.
--
-- The identical gap applies to van sales: a rep sells 200 units to a
-- shop, van stock correctly decrements, shop inventory never moves.
--
-- WHY THIS IS A FUNCTION AND NOT AN AUTOMATIC TRIGGER:
-- distributor_products and products are different tables owned by
-- different businesses. The distributor's "Chekodi 200g" is not
-- automatically the shop's "Chekodi 200g" — the shop may name it
-- differently, price it differently, or not stock it at all. Silently
-- auto-creating products on every delivery would fill a shop's catalog
-- with duplicates they never agreed to. So this is an explicit action
-- the shop takes when goods physically arrive, matching on name and
-- creating only what genuinely doesn't exist yet.
--
-- Idempotent: an order already received cannot be received twice, so a
-- double-tap or retry can't double a shop's stock.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_orders ADD COLUMN IF NOT EXISTS received_at timestamptz;

CREATE OR REPLACE FUNCTION public.receive_stock_order(p_order_id uuid, p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order    record;
  v_item     jsonb;
  v_name     text;
  v_qty      numeric;
  v_price    numeric;
  v_existing uuid;
  v_updated  int := 0;
  v_created  int := 0;
BEGIN
  SELECT * INTO v_order FROM public.stock_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Only the owning shop can receive its own delivery.
  IF v_order.shop_id <> p_shop_id THEN
    RAISE EXCEPTION 'This order belongs to another shop';
  END IF;

  -- Idempotency: receiving twice would silently double the shop's
  -- stock, which is worse than an error message.
  IF v_order.received_at IS NOT NULL THEN
    RAISE EXCEPTION 'This delivery has already been added to your inventory';
  END IF;

  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Confirm delivery first, then add the stock to your inventory';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_name  := trim(v_item->>'name');
    v_qty   := COALESCE((v_item->>'qty')::numeric, 0);
    v_price := COALESCE((v_item->>'price')::numeric, 0);
    CONTINUE WHEN v_name IS NULL OR v_name = '' OR v_qty <= 0;

    -- Match the shop's OWN product by name, case-insensitively. Only
    -- this shop's products — never another shop's row.
    SELECT id INTO v_existing FROM public.products
     WHERE shop_id = p_shop_id AND lower(trim(name)) = lower(v_name)
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.products SET stock = COALESCE(stock, 0) + v_qty WHERE id = v_existing;
      v_updated := v_updated + 1;
    ELSE
      -- New to this shop. Seeded at the price they PAID — the shop sets
      -- their own retail price afterwards; guessing a markup here would
      -- be inventing business data they never entered.
      INSERT INTO public.products (shop_id, name, price, stock)
      VALUES (p_shop_id, v_name, v_price, v_qty);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE public.stock_orders SET received_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('updated', v_updated, 'created', v_created);
END;
$$;

SELECT 'receive_stock_order() installed — delivered stock can now reach shop inventory' AS status;
