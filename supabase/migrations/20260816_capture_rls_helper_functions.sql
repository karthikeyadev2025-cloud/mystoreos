-- ═══════════════════════════════════════════════════════════════════════
-- Capture the RLS helper functions into version control
--
-- current_profile_id(), current_user_role() and get_owned_branch_ids()
-- existed ONLY in the Supabase dashboard — they were never in
-- supabase/migrations. Every RLS policy on public.users depends on them:
--
--   users_select_own_or_admin   USING (id = current_profile_id()
--                                      OR role = 'shop'
--                                      OR current_user_role() = 'admin')
--   users_select_staff_of_owner USING (staff_of = current_profile_id())
--   users_update_own            USING (id = current_profile_id())
--   users_update_admin          USING (current_user_role() = 'admin')
--   users_delete_admin          USING (current_user_role() = 'admin')
--   users_delete_own_staff      USING (... get_owned_branch_ids(...) ...)
--
-- So a database rebuilt from migrations alone (new environment, staging
-- clone, disaster recovery) would come up with policies referencing
-- functions that do not exist. Every policy evaluation then errors and
-- user access breaks in a way that looks like a data problem rather than a
-- schema one — the same shape of silent failure as the select('*') 403.
--
-- Definitions below are the live ones, captured verbatim via
-- pg_get_functiondef(), with one deliberate change noted inline.
--
-- CREATE OR REPLACE preserves existing grants, so applying this to the
-- current production database is a no-op apart from that change.
-- ═══════════════════════════════════════════════════════════════════════

-- Resolves the caller's row in public.users.
--
-- Matches either on the Supabase Auth uid directly, or on phone number for
-- accounts created through the phone/password edge-function flow, where the
-- synthetic auth email is "<phone>@…" and the local-part is the phone.
--
-- SECURITY DEFINER is required: it reads public.users, which is itself
-- protected by policies that call this function. Running as the definer
-- bypasses RLS and avoids infinite recursion.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id
  FROM public.users u
  WHERE u.id = auth.uid()
     OR u.phone = split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()),
          '@', 1
        )
  LIMIT 1
$function$;

-- Role of the calling user ('admin' | 'shop' | 'distributor' | 'staff' | …).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT role FROM public.users WHERE id = public.current_profile_id()
$function$;

-- Branch ids owned by a given main shop.
--
-- CHANGED FROM LIVE: the deployed version is SECURITY DEFINER with NO
-- `SET search_path`. A definer-rights function with a mutable search_path
-- can be redirected by the caller (Supabase's own linter reports this as
-- function_search_path_mutable). The body already schema-qualifies
-- public.users, so pinning search_path changes no behaviour — it just
-- closes the hijacking vector. The other two already pinned it.
CREATE OR REPLACE FUNCTION public.get_owned_branch_ids(owner_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ARRAY(SELECT id FROM public.users WHERE parent_shop_id = owner_id);
$function$;

-- Explicit grants matching the live database (verified: anon and
-- authenticated both hold EXECUTE on all three). Stated here so a rebuilt
-- environment does not depend on PostgreSQL's default PUBLIC EXECUTE grant
-- staying enabled.
GRANT EXECUTE ON FUNCTION public.current_profile_id()            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_branch_ids(uuid)      TO anon, authenticated;

COMMENT ON FUNCTION public.current_profile_id() IS
  'Caller''s public.users id, by auth.uid() or by phone derived from the synthetic auth email. SECURITY DEFINER to avoid RLS recursion. Used by the users RLS policies.';
COMMENT ON FUNCTION public.current_user_role() IS
  'Caller''s role from public.users. Used by the admin branches of the users RLS policies.';
COMMENT ON FUNCTION public.get_owned_branch_ids(uuid) IS
  'Branch ids whose parent_shop_id is the given owner. Used by users_delete_own_staff.';
