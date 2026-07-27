-- ═══════════════════════════════════════════════════════════════════════
-- SERVER-SIDE PRICE VALIDATION FOR CUSTOMER ORDERS
--
-- placeOrder() accepted item prices and the order total straight from
-- the browser and stored them unchecked. The RLS insert policy on
-- orders is `WITH CHECK (true)`, so nothing anywhere verified that the
-- price a customer sent matched the price the shop actually set.
--
-- Anyone able to edit a request could order a ₹5,000 basket for ₹50.
-- In practice the order also reaches the shop over WhatsApp, so a wildly
-- wrong figure would likely be spotted — but "the shopkeeper will
-- probably notice" is not a control, and a small manipulation
-- (₹4,850 instead of ₹5,000) would sail through and quietly corrupt
-- the shop's sales figures, GST liability and stock valuation.
--
-- APPROACH: recompute the total from the shop's OWN product rows and
-- compare. Rejects only when the client's figure is materially LOWER
-- than the truth — the direction that costs the shop money.
--
-- Deliberately does NOT reject a client total that's HIGHER. That
-- happens legitimately when a shop lowers a price while a customer has
-- the page open, and blocking a customer who is willing to pay MORE
-- than the current price would be a bad trade for a bug that costs
-- nobody anything.
--
-- Handles the three ways a real price is formed here: base price,
-- per-variant price overrides, and a discount percentage.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_order_total(
  p_shop_id uuid,
  p_items   jsonb,
  p_total   numeric
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item        jsonb;
  v_prod        record;
  v_qty         numeric;
  v_unit_price  numeric;
  v_variant     text;
  v_server_total numeric := 0;
  v_unknown     int := 0;
  v_tolerance   numeric;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_order');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::numeric, 0);
    CONTINUE WHEN v_qty <= 0;

    SELECT id, price, variant_prices, discount_pct
      INTO v_prod
      FROM public.products
     WHERE id = NULLIF(v_item->>'id','')::uuid
       AND shop_id = p_shop_id;

    IF v_prod.id IS NULL THEN
      -- Item not in this shop's catalogue. Could be a custom line the
      -- shop added manually, so it's counted at the submitted price
      -- rather than rejected outright — but it's reported so the caller
      -- knows the check wasn't total.
      v_unknown := v_unknown + 1;
      v_server_total := v_server_total + (COALESCE((v_item->>'price')::numeric, 0) * v_qty);
      CONTINUE;
    END IF;

    -- Variant override beats the base price when one is set for the
    -- selected variant.
    v_variant := NULLIF(v_item->>'variant','');
    v_unit_price := NULL;
    IF v_variant IS NOT NULL AND v_prod.variant_prices IS NOT NULL THEN
      v_unit_price := NULLIF(v_prod.variant_prices->>v_variant, '')::numeric;
    END IF;
    v_unit_price := COALESCE(v_unit_price, v_prod.price, 0);

    -- Discount applies on top of whichever price was selected.
    IF COALESCE(v_prod.discount_pct, 0) > 0 THEN
      v_unit_price := v_unit_price * (1 - v_prod.discount_pct::numeric / 100);
    END IF;

    v_server_total := v_server_total + (v_unit_price * v_qty);
  END LOOP;

  -- 1% or ₹1, whichever is larger. Absorbs rounding differences between
  -- JS floats and numeric without leaving room for a meaningful
  -- underpayment.
  v_tolerance := GREATEST(1, v_server_total * 0.01);

  IF p_total < v_server_total - v_tolerance THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'price_mismatch',
      'submitted', p_total,
      'expected', round(v_server_total, 2)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'expected', round(v_server_total, 2),
    'unverified_lines', v_unknown
  );
END;
$$;

SELECT 'validate_order_total() installed' AS status;
