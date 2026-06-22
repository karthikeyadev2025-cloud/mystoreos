-- ─────────────────────────────────────────────────────────────────────────
-- Atomic stock transfer RPC. Replaces the sequential JS calls in
-- api.createStockTransfer which had no transaction guarantee — a network
-- drop between source-decrement and target-increment left stock in an
-- inconsistent state with no automatic rollback.
--
-- This function runs entirely inside one Postgres transaction: either
-- every item moves and the voucher is written, or nothing happens.
--
-- Inputs (JSONB):
--   p_from_shop_id  UUID — source branch
--   p_to_shop_id    UUID — destination branch
--   p_owner_id      UUID — caller (ownership checked inside)
--   p_note          TEXT — optional free-text
--   p_items         JSONB — array of:
--                     { productId, qty, productName?, barcode? }
--
-- Returns JSONB:
--   { id, status, failures }
--   status is always 'completed' (function raises on any item failure)
--
-- Error cases that RAISE (roll back everything):
--   • shops don't belong to same brand
--   • caller doesn't own the brand
--   • a product doesn't exist on the source
--   • source has insufficient stock
--
-- SECURITY DEFINER so it can UPDATE products across both shops even
-- when RLS restricts the caller to their own shop_id rows.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transfer_stock(
  p_from_shop_id  UUID,
  p_to_shop_id    UUID,
  p_owner_id      UUID,
  p_note          TEXT,
  p_items         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_src         RECORD;
  v_tgt         RECORD;
  v_src_root    UUID;
  v_tgt_root    UUID;
  v_item        JSONB;
  v_product_id  UUID;
  v_qty         INTEGER;
  v_src_prod    RECORD;
  v_tgt_prod    RECORD;
  v_transfer_id UUID;
  v_new_stock   INTEGER;
BEGIN
  -- ── Ownership / same-brand check ────────────────────────────────────────
  SELECT id, parent_shop_id INTO v_src FROM users WHERE id = p_from_shop_id;
  SELECT id, parent_shop_id INTO v_tgt FROM users WHERE id = p_to_shop_id;

  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'One or both branch IDs not found';
  END IF;

  v_src_root := COALESCE(v_src.parent_shop_id, v_src.id);
  v_tgt_root := COALESCE(v_tgt.parent_shop_id, v_tgt.id);

  IF v_src_root <> v_tgt_root THEN
    RAISE EXCEPTION 'Both branches must belong to the same brand';
  END IF;

  IF v_src_root <> p_owner_id
    AND p_from_shop_id <> p_owner_id
    AND p_to_shop_id <> p_owner_id
  THEN
    RAISE EXCEPTION 'You do not own these branches';
  END IF;

  -- ── Pre-flight: validate every item before touching any stock ───────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'qty must be > 0 for product %', v_product_id;
    END IF;

    SELECT id, name, stock INTO v_src_prod
      FROM products WHERE id = v_product_id AND shop_id = p_from_shop_id;

    IF v_src_prod.id IS NULL THEN
      RAISE EXCEPTION 'Product % not found on source branch', v_product_id;
    END IF;

    IF COALESCE(v_src_prod.stock, 0) < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for % — have %, need %',
        v_src_prod.name, COALESCE(v_src_prod.stock, 0), v_qty;
    END IF;
  END LOOP;

  -- ── Write the voucher (in_progress → completed at end) ─────────────────
  INSERT INTO stock_transfers (from_shop_id, to_shop_id, items, created_by, note, status)
  VALUES (p_from_shop_id, p_to_shop_id, p_items, p_owner_id, p_note, 'in_progress')
  RETURNING id INTO v_transfer_id;

  -- ── Apply each item move ─────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;

    -- Decrement source (re-fetch for accurate current stock)
    SELECT id, stock, name, barcode, selling_price, cost_price,
           category, sku, hsn_code, unit, tax_rate, image_url,
           images, discount_pct, is_featured
      INTO v_src_prod
      FROM products WHERE id = v_product_id AND shop_id = p_from_shop_id
      FOR UPDATE;  -- row-level lock prevents concurrent transfer races

    v_new_stock := COALESCE(v_src_prod.stock, 0) - v_qty;
    IF v_new_stock < 0 THEN
      -- Concurrent transfer drained the stock between pre-flight and now
      RAISE EXCEPTION 'Concurrent transfer: not enough stock for %', v_src_prod.name;
    END IF;

    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;

    -- Find matching product on target (barcode preferred, then name)
    SELECT id, stock INTO v_tgt_prod
      FROM products
      WHERE shop_id = p_to_shop_id
        AND (
          (v_src_prod.barcode IS NOT NULL AND barcode = v_src_prod.barcode)
          OR LOWER(name) = LOWER(v_src_prod.name)
        )
      ORDER BY
        CASE WHEN v_src_prod.barcode IS NOT NULL AND barcode = v_src_prod.barcode THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE;

    IF v_tgt_prod.id IS NOT NULL THEN
      UPDATE products
        SET stock = COALESCE(v_tgt_prod.stock, 0) + v_qty
        WHERE id = v_tgt_prod.id;
    ELSE
      -- Clone product to target with stock = qty
      INSERT INTO products (
        shop_id, name, barcode, selling_price, cost_price,
        category, sku, hsn_code, unit, tax_rate, image_url,
        images, discount_pct, is_featured, stock
      ) VALUES (
        p_to_shop_id, v_src_prod.name, v_src_prod.barcode, v_src_prod.selling_price,
        v_src_prod.cost_price, v_src_prod.category, v_src_prod.sku, v_src_prod.hsn_code,
        v_src_prod.unit, v_src_prod.tax_rate, v_src_prod.image_url,
        v_src_prod.images, v_src_prod.discount_pct, v_src_prod.is_featured, v_qty
      );
    END IF;
  END LOOP;

  -- ── Finalize voucher ─────────────────────────────────────────────────────
  UPDATE stock_transfers SET status = 'completed' WHERE id = v_transfer_id;

  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'status', 'completed',
    'failures', '[]'::jsonb
  );
END;
$$;
