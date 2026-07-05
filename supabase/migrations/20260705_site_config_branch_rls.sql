-- ─────────────────────────────────────────────────────────────────────────
-- BUG FIX: 403 when saving Print Settings (or any shop-scoped site_config
-- key) for a BRANCH.
--
-- Verified live: owner switches to a branch → Save Print Settings →
-- POST /rest/v1/site_config returns 403.
--
-- Root cause: site_config write policies only allow keys containing the
-- CURRENT USER's id:
--     key LIKE '%' || auth.uid() || '%'  OR  '%' || current_profile_id() || '%'
-- A branch's key is printSettings_<branchId> — the branch is a separate
-- users row, so the key contains neither id → INSERT/UPDATE blocked.
--
-- Every other table already solved exactly this with owns_shop(uuid)
-- (20260622_branch_rls_all_tables.sql), which allows the main owner to
-- act on shops where parent_shop_id = current_profile_id(). site_config
-- was the one table left out because its "shop id" lives inside a text
-- key instead of a shop_id column.
--
-- Fix: extract the UUID embedded in the key and run it through
-- owns_shop(). Keys with no UUID (global config: announcement, pricing_v2,
-- subscription_plans…) don't match this branch-clause and stay governed
-- by the existing admin policies, unchanged.
-- ─────────────────────────────────────────────────────────────────────────

-- Extract the first UUID embedded in a site_config key, or NULL.
-- IMMUTABLE + strict regex → safe to call inside RLS policies.
CREATE OR REPLACE FUNCTION public.site_config_key_shop_id(p_key TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT substring(
    p_key FROM '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  )::uuid;
$$;

DROP POLICY IF EXISTS "site_config_shop_write"  ON public.site_config;
DROP POLICY IF EXISTS "site_config_shop_update" ON public.site_config;

CREATE POLICY "site_config_shop_write"
  ON public.site_config FOR INSERT
  WITH CHECK (
    key LIKE '%' || auth.uid()::text || '%'
    OR key LIKE '%' || public.current_profile_id()::text || '%'
    OR (
      public.site_config_key_shop_id(key) IS NOT NULL
      AND public.owns_shop(public.site_config_key_shop_id(key))
    )
  );

CREATE POLICY "site_config_shop_update"
  ON public.site_config FOR UPDATE
  USING (
    key LIKE '%' || auth.uid()::text || '%'
    OR key LIKE '%' || public.current_profile_id()::text || '%'
    OR (
      public.site_config_key_shop_id(key) IS NOT NULL
      AND public.owns_shop(public.site_config_key_shop_id(key))
    )
  );

SELECT 'site_config branch RLS fixed: owners can now save settings for their branches' AS status;
