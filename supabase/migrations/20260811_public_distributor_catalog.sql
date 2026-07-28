-- ═══════════════════════════════════════════════════════════════════════
-- PUBLIC DISTRIBUTOR CATALOG — anonymous profile lookup by code
--
-- The shared catalog link needs to work for someone who has NEVER
-- logged in — that is the entire point of sharing it with 10,000 shops
-- who don't have MyStore OS accounts yet. distributor_products already
-- has USING (true), genuinely public. `users` does not, correctly,
-- since it holds passwords and every other account's private data.
--
-- REJECTED APPROACH, CAUGHT BEFORE APPLYING ANYTHING: a first draft
-- added a row-level policy plus a plain REVOKE/GRANT on columns. While
-- writing it, checked the EXISTING policies on `users` first and found
-- "users_select_public_profile" already grants FULL-COLUMN read on any
-- role='shop' row with no auth.uid() check at all — meaning anon
-- already holds a broad SELECT grant on this table for shop discovery.
-- A blanket REVOKE SELECT ... FROM anon would have silently broken
-- that existing, working feature. Column-scoping on top of an
-- already-broad grant would not have been safe either.
--
-- (Separately: that existing policy appears to expose the `pass`
-- column on every shop row to anon today, which is a real pre-existing
-- concern independent of this feature — flagged to the user, not
-- silently fixed here since it's outside this change's scope and
-- touching it could break shop-discovery/marketplace features that
-- may depend on it.)
--
-- FIX: sidesteps GRANT/RLS interaction entirely. A SECURITY DEFINER
-- function runs as its owner, bypassing RLS internally, and returns
-- ONLY the four fields explicitly listed in its RETURNS TABLE — there
-- is no table-level grant to get wrong and no interaction with any
-- other policy on this table, existing or future.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_distributor_public_profile(p_code text)
RETURNS TABLE (id uuid, name text, logo text, business_address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name, u.logo, u.business_address
    FROM public.users u
   WHERE u.role = 'distributor'
     AND u.public_code = upper(trim(p_code))
   LIMIT 1;
$$;

-- Anyone may CALL the function; the function itself decides what it
-- returns, so this grant cannot be used to read anything beyond the
-- four columns above, regardless of caller.
GRANT EXECUTE ON FUNCTION public.get_distributor_public_profile(text) TO anon, authenticated;

SELECT 'Public distributor catalog profile lookup enabled via security-definer function' AS status;
