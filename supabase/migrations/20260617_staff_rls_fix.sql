-- ============================================================
-- Fix: staff accounts could not be created because the users
-- table had no INSERT policy (RLS returned 403).
--
-- The add-staff edge function uses the service-role key which
-- bypasses RLS entirely, but we also add an explicit policy
-- so shop owners can see their own staff rows in SELECT queries.
-- ============================================================

-- Allow a shop owner to read their own staff rows
-- (staff rows have staff_of = owner's id, role = 'staff')
DROP POLICY IF EXISTS "users_select_staff_of_owner" ON public.users;
CREATE POLICY "users_select_staff_of_owner" ON public.users
  FOR SELECT USING (
    staff_of = public.current_profile_id()
  );

SELECT 'Staff RLS policies applied' AS status;
