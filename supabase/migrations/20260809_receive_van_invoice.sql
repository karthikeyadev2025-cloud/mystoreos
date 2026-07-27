-- ═══════════════════════════════════════════════════════════════════════
-- RECEIVE A VAN PURCHASE INTO SHOP INVENTORY
--
-- FOUND IN PHASE 7 (van sales -> dispatch -> inventory testing):
-- the same gap fixed earlier for stock orders exists again for van
-- sales, because they take a completely different path.
--
--   stock order delivered  ->  "Add to Stock" button  ->  inventory up
--   van sale to a shop     ->  nothing at all
--
-- A rep sells 200 units off the van, the van's stock correctly drops,
-- the shop is correctly billed — and the shop's own product stock never
-- moves. The shopkeeper has to hand-edit every product afterwards,
-- which is exactly the manual work having both sides in one product is
-- supposed to remove.
--
-- Mirrors receive_stock_order deliberately: same name-matching, same
-- idempotency, same refusal to overwrite the shop's own retail price.
-- Two near-identical functions is the right call here — van_invoices
-- and stock_orders have different shapes and different owners, and
-- forcing one function to serve both would make each harder to reason
-- about than the duplication saves.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.van_invoices ADD COLUMN IF NOT EXISTS received_at timestamptz;

CREATE OR REPLACE FUNCTION public.receive_van_invoice(p_invoice_id uuid, p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv      record;
  v_line     record;
  v_existing uuid;
  v_updated  int := 0;
  v_created  int := 0;
BEGIN
  SELECT * INTO v_inv FROM public.van_invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  -- Only the shop that was billed can receive it.
  IF v_inv.shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'This purchase belongs to another shop';
  END IF;

  -- Receiving twice would silently double the shop's stock.
  IF v_inv.received_at IS NOT NULL THEN
    RAISE EXCEPTION 'This purchase has already been added to your inventory';
  END IF;

  FOR v_line IN
    SELECT l.qty_base, l.rate, COALESCE(p.name, 'Item') AS product_name
      FROM public.van_invoice_lines l
      LEFT JOIN public.distributor_products p ON p.id = l.product_id
     WHERE l.invoice_id = p_invoice_id
  LOOP
    CONTINUE WHEN v_line.qty_base IS NULL OR v_line.qty_base <= 0;

    -- Match this shop's OWN catalogue by name, case-insensitively.
    SELECT id INTO v_existing FROM public.products
     WHERE shop_id = p_shop_id
       AND lower(trim(name)) = lower(trim(v_line.product_name))
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Stock only. The shop's retail price is deliberately left alone:
      -- overwriting it with the wholesale rate they just paid would
      -- silently wipe out their entire margin.
      UPDATE public.products
         SET stock = COALESCE(stock, 0) + v_line.qty_base
       WHERE id = v_existing;
      v_updated := v_updated + 1;
    ELSE
      -- New to this shop. Seeded at the price they PAID; they set their
      -- own selling price afterwards. Inventing a markup here would be
      -- fabricating business data they never entered.
      INSERT INTO public.products (shop_id, name, price, stock)
      VALUES (p_shop_id, v_line.product_name, v_line.rate, v_line.qty_base);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE public.van_invoices SET received_at = now() WHERE id = p_invoice_id;

  RETURN jsonb_build_object('updated', v_updated, 'created', v_created);
END;
$$;

SELECT 'receive_van_invoice() installed — van purchases can now reach shop inventory' AS status;
