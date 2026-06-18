-- Allow shop owners (and admin) to delete their own orders, credits, and
-- stock_orders rows — needed for the "Reset Test Data" feature so a shop
-- that has been testing the system can wipe fake bills and start fresh
-- before going live with real customers.
--
-- Staff accounts log in with their own auth.uid() (not the owner's), so
-- shop_id = auth.uid() correctly restricts this to the shop OWNER only —
-- staff cannot wipe the shop's bill history.

CREATE POLICY "orders_delete_shop"
  ON public.orders FOR DELETE
  USING (shop_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "credits_delete_shop"
  ON public.credits FOR DELETE
  USING (to_shop_id = auth.uid() OR from_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "stock_orders_delete_shop"
  ON public.stock_orders FOR DELETE
  USING (shop_id = auth.uid() OR distributor_id = auth.uid() OR public.current_user_role() = 'admin');

SELECT 'DELETE policies added for orders, credits, stock_orders' AS status;
