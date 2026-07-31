-- ═══════════════════════════════════════════════════════════════════════
-- verify_admin_pin RPC
--
-- Fallout from 20260730_p0_security_fixes.sql, which (correctly) ran:
--   REVOKE SELECT (pass, pass_verify) ON public.users FROM anon, authenticated;
--
-- api.js verifyAdminPin() did:
--   supabase.from('users').select('pass').eq('id', shopId)
-- ...then compared the value in the browser. After the revoke that SELECT is
-- denied (42501 -> HTTP 403), so the maker-checker Admin PIN prompt began
-- failing for every shop.
--
-- Re-granting the column would undo the security fix, and shipping the
-- credential to the browser to compare it there was the wrong shape to begin
-- with. This moves the comparison server-side: the PIN goes in, a boolean
-- comes out, and the stored value never leaves the database.
--
-- SECURITY DEFINER so it can read the revoked column; search_path pinned so
-- the definer's rights can't be redirected via a hostile search_path.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_shop_id uuid, p_pin text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_shop_id
      AND pass IS NOT NULL
      AND pass = p_pin
  );
$$;

REVOKE ALL ON FUNCTION public.verify_admin_pin(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.verify_admin_pin(uuid, text) IS
  'Server-side Admin PIN check. Returns true/false only; never exposes users.pass. '
  'NOTE: this endpoint is brute-forceable by design of the feature (short PIN, '
  'unauthenticated callers allowed). Consider adding rate limiting per shop_id '
  'and/or storing the PIN as a hash rather than plaintext as a follow-up.';
