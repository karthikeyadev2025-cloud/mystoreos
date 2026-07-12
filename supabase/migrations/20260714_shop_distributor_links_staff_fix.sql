-- ═══════════════════════════════════════════════════════════════════════
-- shop_distributor_links never accounted for staff sessions.
--
-- Same regression SHAPE as owns_shop() (fixed earlier this session in
-- 20260712_fix_owns_shop_staff_regression.sql), but this table predates
-- that fix and was never part of the sweep — it uses current_profile_id()
-- directly (the caller's OWN account id, no staff_of resolution) rather
-- than the shared staff-aware helper.
--
-- Found while wiring a shop's wholesale catalog to actually respect
-- these links (see api.getLinkedDistributorProducts) — a staff member
-- browsing Restock would have seen a completely empty catalog, since
-- the shop's real links live under the OWNER's account id, and a staff
-- session's current_profile_id() is their own separate staff account,
-- which never has any links of its own.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS sdl_read ON public.shop_distributor_links;
CREATE POLICY sdl_read ON public.shop_distributor_links FOR SELECT USING (
  shop_id = public.current_user_shop_id()
  OR distributor_id = public.current_user_shop_id()
  OR public.current_user_role() = 'admin'
);

DROP POLICY IF EXISTS sdl_insert ON public.shop_distributor_links;
CREATE POLICY sdl_insert ON public.shop_distributor_links FOR INSERT WITH CHECK (
  shop_id = public.current_user_shop_id()
  OR distributor_id = public.current_user_shop_id()
  OR public.current_user_role() = 'admin'
);

DROP POLICY IF EXISTS sdl_delete ON public.shop_distributor_links;
CREATE POLICY sdl_delete ON public.shop_distributor_links FOR DELETE USING (
  shop_id = public.current_user_shop_id()
  OR distributor_id = public.current_user_shop_id()
  OR public.current_user_role() = 'admin'
);

SELECT 'shop_distributor_links now resolves staff sessions correctly — staff can link/view/unlink distributors for the shop they work at' AS status;
