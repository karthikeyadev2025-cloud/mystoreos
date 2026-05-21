-- Migration: allow shop owners to write their own site_config keys
-- site_config keys follow the pattern: <feature>_<shopId>[_<extra>]
-- A shop owner's auth.uid() IS their shopId, so the LIKE check is safe.
-- PostgreSQL RLS: multiple permissive policies for the same operation are OR'd.

CREATE POLICY IF NOT EXISTS "site_config_shop_write"
  ON public.site_config FOR INSERT
  WITH CHECK (key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY IF NOT EXISTS "site_config_shop_update"
  ON public.site_config FOR UPDATE
  USING (key LIKE '%' || auth.uid()::text || '%');
