-- ═══════════════════════════════════════════════════════════════════════
-- ROOT FIX: owns_shop() never accounted for staff logins
--
-- Timeline of this exact bug, traced across five prior migrations:
--   20260619_fix_staff_orders_rls.sql — introduced current_user_shop_id()
--     = COALESCE(staff_of, id), fixed orders/products/credits for staff.
--   20260620_fix_legacy_account_rls_gaps.sql — merged in legacy-account
--     (phone-email) fallback so current_user_shop_id() handles BOTH
--     staff sessions and pre-migration seed accounts correctly.
--   20260622_branch_rls_all_tables.sql — added branch support via a NEW
--     function, owns_shop(p_shop_id), built on current_profile_id()
--     (own id only — no staff_of resolution). This DROPPED and
--     RECREATED orders_read_shop / orders_insert_shop / orders_update_shop
--     / orders_delete_shop, expenses_*, staff_*, credits_*, and
--     stock_orders_* to all use owns_shop() instead of the staff-aware
--     current_user_shop_id() — silently regressing every one of those
--     tables for staff logins. Owner-viewed data was unaffected (which
--     is why this went unnoticed for a while), but any staff member
--     ringing up a sale, taking a credit/khata payment, logging an
--     expense, or placing a stock order would have the write succeed
--     (the permissive orders_insert_any / equivalent fallback policies
--     still allowed the INSERT) but then be unable to SEE what they'd
--     just done — the row silently vanishes from their own view because
--     the SELECT policy filters it out. This is very likely the exact
--     shape of the "staff billing not saved" report: the bill IS saved,
--     but the staff member's own screen can never read it back to
--     confirm, update the Bills list, or reflect it in daily totals.
--   20260624_fix_staff_visibility.sql — fixed a DIFFERENT, adjacent gap
--     (owners couldn't see their OWN staff in the users table) — did
--     not touch orders/credits/expenses/staff-table policies.
--   20260626_fix_products_staff_rls_regression.sql — re-fixed ONLY the
--     products table (3 policies) back to current_user_shop_id() after
--     diagnosing this exact regression pattern — but only for products.
--     orders / credits / expenses / staff / stock_orders were never
--     brought back, and remained broken for staff logins from
--     20260622 onward.
--
-- Root fix, this migration: rather than re-patching each individual
-- policy again (the same whack-a-mole this bug has already been through
-- five times), fix owns_shop() ITSELF at the source. Every policy that
-- already calls owns_shop() — orders, expenses, staff, credits,
-- stock_orders, flash_sales, and anything added after 20260622 that
-- followed the same pattern — is fixed simultaneously, with no need to
-- touch individual policies again.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owns_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    -- Own shop, OR the shop a staff session's staff_of resolves to
    -- (current_user_shop_id() = COALESCE(staff_of, id), with the
    -- legacy-account phone-email fallback already merged in). A
    -- branch-assigned staff member's staff_of IS the branch's own id,
    -- so this line alone already covers "staff at a branch, viewing
    -- that branch's own data" — no separate case needed for it.
    p_shop_id = public.current_user_shop_id()
    OR EXISTS (                                        -- main owner (or their staff) viewing a branch's data
      SELECT 1 FROM public.users
      WHERE id = p_shop_id
        AND parent_shop_id = public.current_user_shop_id()
    )
    OR public.current_user_role() = 'admin';
$$;

SELECT 'owns_shop() now resolves staff_of — orders/credits/expenses/staff/stock_orders all fixed for staff logins in one place' AS status;
