-- Fix: shop owners couldn't see their own staff in the users table
-- because the SELECT policy only allowed:
--   - own row
--   - all shop profiles (role='shop')
--   - branches you own (parent_shop_id = caller)
--   - admin
--
-- Staff rows have role='staff' and staff_of=shopId — matched NONE of these.
-- The query returned 200 with an empty array every time.
--
-- Fix: add two more conditions:
--   1. staff_of = current_profile_id()  → main owner sees their own staff
--   2. staff_of IN (SELECT id FROM users WHERE parent_shop_id = current_profile_id())
--                                       → main owner sees staff of their branches

DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;

CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT USING (
    id = public.current_profile_id()                        -- own row
    OR role = 'shop'                                        -- all shop public profiles
    OR parent_shop_id = public.current_profile_id()         -- branches you own
    OR staff_of = public.current_profile_id()               -- your direct staff
    OR staff_of IN (                                        -- staff of your branches
      SELECT id FROM public.users
      WHERE parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'                 -- admin sees all
  );

SELECT 'Staff visibility fix: shop owners can now read staff of their branches' AS status;
