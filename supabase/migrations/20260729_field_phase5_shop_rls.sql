-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 5a — shop read-access to their own van transactions
--
-- BUG CAUGHT BEFORE SHIPPING, by checking the actual RLS policy
-- before building the shopkeeper self-service screen on top of it:
-- van_invoices_own and van_returns_own only ever granted access to
-- distributor_id = acting_distributor_id(). A shop querying its own
-- van_invoices WHERE shop_id = themselves would be silently returned
-- zero rows — not an error, just an empty, wrong-looking ledger. The
-- entire "shopkeeper self-service" feature would have looked like it
-- worked and shown nothing, which is worse than an obvious failure.
--
-- FIX: additive policy granting a shop read-only access to rows where
-- shop_id matches their own profile id. Purely additive — the
-- distributor's own access via the *_own policies is untouched, and
-- this grants SELECT only, never INSERT/UPDATE/DELETE, so a shop
-- cannot alter its own purchase or return history.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS van_invoices_shop_read ON public.van_invoices;
CREATE POLICY van_invoices_shop_read ON public.van_invoices FOR SELECT
  USING (shop_id = public.current_profile_id());

DROP POLICY IF EXISTS van_invoice_lines_shop_read ON public.van_invoice_lines;
CREATE POLICY van_invoice_lines_shop_read ON public.van_invoice_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.van_invoices i
                 WHERE i.id = van_invoice_lines.invoice_id
                   AND i.shop_id = public.current_profile_id()));

DROP POLICY IF EXISTS van_returns_shop_read ON public.van_returns;
CREATE POLICY van_returns_shop_read ON public.van_returns FOR SELECT
  USING (shop_id = public.current_profile_id());

DROP POLICY IF EXISTS van_return_lines_shop_read ON public.van_return_lines;
CREATE POLICY van_return_lines_shop_read ON public.van_return_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.van_returns r
                 WHERE r.id = van_return_lines.return_id
                   AND r.shop_id = public.current_profile_id()));

SELECT 'Shop read-access to own van transactions granted' AS status;
