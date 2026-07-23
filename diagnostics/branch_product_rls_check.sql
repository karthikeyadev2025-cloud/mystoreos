-- ═══════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC — run this in Supabase SQL Editor and share the full output.
-- This does not change anything, purely read-only, safe to run anytime.
--
-- Checking three things that could each independently cause exactly the
-- error you saw: "new row violates row-level security policy for table
-- products" when adding a product from a branch (/shop/branch/... URL).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Is owns_shop() actually the current, correct version live right now?
-- Should show the branch-aware version (checks current_user_shop_id()
-- AND parent_shop_id) — if it shows an older/shorter version instead,
-- that specific migration never actually landed.
SELECT pg_get_functiondef('public.owns_shop(uuid)'::regprocedure) AS owns_shop_live_definition;

-- 2. Is current_user_shop_id() the current, correct version?
SELECT pg_get_functiondef('public.current_user_shop_id()'::regprocedure) AS current_user_shop_id_live_definition;

-- 3. Every branch currently in the system, and whether its parent_shop_id
-- is actually set correctly. A branch with a NULL or wrong parent_shop_id
-- would make owns_shop() correctly reject product-adds for it — this
-- would point at a DATA problem for that specific branch, not a code bug.
SELECT id AS branch_id, name AS branch_name, parent_shop_id, role, status
FROM public.users
WHERE parent_shop_id IS NOT NULL
ORDER BY name;

-- 4. The exact current INSERT policy on products, to confirm it's really
-- calling owns_shop() (not some older/different check).
SELECT polname, pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.products'::regclass AND polcmd = 'a'; -- 'a' = INSERT
