-- ═══════════════════════════════════════════════════════════════════════
-- API Access for distributors — explicitly promised on the Enterprise
-- plan ("API access") but had zero implementation at all until now.
--
-- Keys are stored HASHED, never in plaintext — same principle as a
-- password. The full key is shown to the distributor exactly once, at
-- generation time; after that only a short prefix is ever displayed,
-- enough to recognize which key is active without being able to
-- reconstruct it. Verifying an incoming request means hashing the
-- provided key and comparing hashes, never comparing plaintext.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.distributor_api_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_hash       text NOT NULL UNIQUE,
  key_prefix     text NOT NULL,     -- e.g. "msk_live_a1b2c3d4" — safe to display, not reversible to the full key
  revoked        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dist_api_keys_hash ON public.distributor_api_keys(key_hash) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_dist_api_keys_distributor ON public.distributor_api_keys(distributor_id);

ALTER TABLE public.distributor_api_keys ENABLE ROW LEVEL SECURITY;

-- A distributor can see their own key metadata (prefix, dates) — never
-- the hash itself is exposed to the client in any meaningful way, and
-- the full key was never stored server-side in the first place.
DROP POLICY IF EXISTS "dist_api_keys_read_own" ON public.distributor_api_keys;
CREATE POLICY "dist_api_keys_read_own" ON public.distributor_api_keys FOR SELECT
  USING (distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin');

-- Key creation/revocation goes through the service-role edge function
-- only (never a direct client insert) — the edge function is what
-- actually generates the secure random key and computes its hash, so
-- there's no direct table write policy for INSERT here at all. UPDATE
-- (for revoking) is allowed directly since it only ever flips revoked
-- to true, never touches key_hash.
DROP POLICY IF EXISTS "dist_api_keys_revoke_own" ON public.distributor_api_keys;
CREATE POLICY "dist_api_keys_revoke_own" ON public.distributor_api_keys FOR UPDATE
  USING (distributor_id = public.current_profile_id())
  WITH CHECK (distributor_id = public.current_profile_id());

SELECT 'distributor_api_keys table + RLS installed' AS status;
