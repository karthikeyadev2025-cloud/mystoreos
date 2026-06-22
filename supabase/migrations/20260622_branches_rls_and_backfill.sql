-- ─────────────────────────────────────────────────────────────────────────
-- Branch RLS + backfill fix
--
-- The 20260622_branches.sql migration added parent_shop_id to users but
-- no RLS policy allows reading branches by parent_shop_id. Without a
-- policy, the getOwnedBranches query:
--   SELECT * FROM users WHERE id = X OR parent_shop_id = X
-- returns 400 because the anon/authenticated role can see rows where
-- role = 'shop' (public profile policy) but PostgREST's row-level
-- planner still rejects the parent_shop_id filter if the column
-- was only just added.
--
-- Fix 1: ensure the column exists (idempotent)
-- Fix 2: add an explicit RLS policy that lets a shop owner read their
--         own branches via parent_shop_id
-- Fix 3: Re-enable reading shop rows via parent_shop_id for all roles
-- ─────────────────────────────────────────────────────────────────────────

-- Idempotent column adds (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_shop_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_deleted_at TIMESTAMPTZ;

-- Index
CREATE INDEX IF NOT EXISTS users_active_branches_idx
  ON users (parent_shop_id)
  WHERE parent_shop_id IS NOT NULL AND branch_deleted_at IS NULL;

-- Drop old select policies and recreate with branch support
-- The existing policy allows: own row OR role='shop' OR admin
-- We extend it to also allow: reading a branch if you own the parent
-- (i.e. the row's parent_shop_id = current user's id)
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;

CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT USING (
    id = public.current_profile_id()                  -- own row
    OR role = 'shop'                                  -- all shop public profiles
    OR parent_shop_id = public.current_profile_id()   -- branches you own
    OR public.current_user_role() = 'admin'           -- admin sees all
  );

SELECT 'Branch RLS and backfill migration complete' AS status;
