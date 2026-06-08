-- ============================================================
-- Fix RLS on referral_codes / referral_attributions
--
-- These tables were created outside the tracked migrations and their RLS
-- blocked the legitimate owner from creating their own referral code:
-- getOrCreateReferralCode() insert returned 403 even when
-- owner_id = current_profile_id(), so the affiliate dashboard showed a
-- blank code ("—") and the referral program could not function.
--
-- Correct model:
--   referral_codes:
--     - owner can SELECT/INSERT/UPDATE their own code
--     - admin full access
--     - (public read of a code by value happens via edge/anon during signup
--        attribution; keep that out of here — handled by applyReferral path)
--   referral_attributions:
--     - the referrer (code owner) can read their attributions
--     - admin full access (approve/pay commissions)
-- ============================================================

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

-- ---- referral_codes ----
DROP POLICY IF EXISTS "ref_codes_select_own"   ON public.referral_codes;
DROP POLICY IF EXISTS "ref_codes_insert_own"   ON public.referral_codes;
DROP POLICY IF EXISTS "ref_codes_update_own"   ON public.referral_codes;
DROP POLICY IF EXISTS "ref_codes_admin_all"    ON public.referral_codes;
DROP POLICY IF EXISTS "ref_codes_public_read"  ON public.referral_codes;

-- Owner reads their own code; admin reads all
CREATE POLICY "ref_codes_select_own" ON public.referral_codes
  FOR SELECT USING (
    owner_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- Anyone (incl. anon during signup) may look up an ACTIVE code by value to
-- attribute a referral. Only active codes are exposed.
CREATE POLICY "ref_codes_public_read" ON public.referral_codes
  FOR SELECT USING (is_active = true);

-- Owner creates their own code; admin can create for anyone
CREATE POLICY "ref_codes_insert_own" ON public.referral_codes
  FOR INSERT WITH CHECK (
    owner_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- Owner updates their own code; admin updates any
CREATE POLICY "ref_codes_update_own" ON public.referral_codes
  FOR UPDATE USING (
    owner_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- ---- referral_attributions ----
DROP POLICY IF EXISTS "ref_attr_select_referrer" ON public.referral_attributions;
DROP POLICY IF EXISTS "ref_attr_insert_any"      ON public.referral_attributions;
DROP POLICY IF EXISTS "ref_attr_admin_all"       ON public.referral_attributions;

-- Referrer sees their own attributions; admin sees all
CREATE POLICY "ref_attr_select_referrer" ON public.referral_attributions
  FOR SELECT USING (
    referrer_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- A new signup (any authenticated user, or anon during register) can create
-- an attribution row pointing at themselves as the referred user.
CREATE POLICY "ref_attr_insert_any" ON public.referral_attributions
  FOR INSERT WITH CHECK (true);

-- Admin updates (approve / pay commission)
CREATE POLICY "ref_attr_admin_all" ON public.referral_attributions
  FOR UPDATE USING (public.current_user_role() = 'admin');

SELECT 'Referral RLS fixed: owners can create/read codes, admin manages all' AS status;
