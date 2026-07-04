-- ─────────────────────────────────────────────────────────────────────────
-- BUG FIX: Print Settings (and any other shop-scoped site_config key)
-- silently failing to save for shop owners whose Supabase Auth UID does
-- not exactly equal their public.users.id.
--
-- Root cause: 20260521_v4_site_config_shop_rls.sql checks
--   key LIKE '%' || auth.uid()::text || '%'
-- using the RAW auth.uid(). But auth.uid() and public.users.id only match
-- for accounts fully migrated to Supabase Auth with identical UUIDs.
-- Every other RLS policy in this schema (products, orders, services, etc)
-- uses current_profile_id() specifically because it resolves BOTH cases:
--   1. auth.uid() = users.id directly (fully migrated accounts), OR
--   2. auth.uid() maps via auth.users.email → phone → users.phone lookup
--      (phone-login accounts that predate full Auth migration)
-- site_config was the one table that never got this fix, so shop owners
-- whose accounts fall into case 2 had EVERY site_config write silently
-- do nothing — no error thrown, Supabase upsert just affects 0 rows.
-- This is exactly the "Print Settings never change" bug.
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "site_config_shop_write"  ON public.site_config;
DROP POLICY IF EXISTS "site_config_shop_update" ON public.site_config;

CREATE POLICY "site_config_shop_write"
  ON public.site_config FOR INSERT
  WITH CHECK (
    key LIKE '%' || auth.uid()::text || '%'
    OR key LIKE '%' || public.current_profile_id()::text || '%'
  );

CREATE POLICY "site_config_shop_update"
  ON public.site_config FOR UPDATE
  USING (
    key LIKE '%' || auth.uid()::text || '%'
    OR key LIKE '%' || public.current_profile_id()::text || '%'
  );

-- Also allow the same shop to SELECT their own settings back (needed for
-- reliably reloading Print Settings on next login/page refresh — without
-- this, getSiteConfig() falls back to defaults every time even after a
-- successful save, which looks identical to "settings not saving").
DROP POLICY IF EXISTS "site_config_shop_read" ON public.site_config;
CREATE POLICY "site_config_shop_read"
  ON public.site_config FOR SELECT
  USING (
    key LIKE '%' || auth.uid()::text || '%'
    OR key LIKE '%' || public.current_profile_id()::text || '%'
    OR true  -- site_config also holds PUBLIC platform config (pricing, announcements) — safe to read
  );

SELECT 'site_config RLS fixed: shop owners can now save/reload their own settings reliably' AS status;
