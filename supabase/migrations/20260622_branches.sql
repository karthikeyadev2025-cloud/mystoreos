-- ─────────────────────────────────────────────────────────────────────────
-- Multi-branch support: a shop owner can run multiple physical locations
-- of the same business (RK Mens & Jeans — Main + RK Mens & Jeans —
-- Hitech City Branch, etc). Each branch is its own user row with
-- role='shop', so existing tables (products.shop_id, orders.shop_id,
-- staff.staff_of) naturally scope per-branch without any schema changes
-- to those tables.
--
-- A branch is just a shop record linked to its parent's id. Parent shop
-- (the originally-registered owner account) has parent_shop_id = NULL.
-- Branch rows have parent_shop_id = the owner's id.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parent_shop_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Soft delete for branches — historical orders/products must keep their
-- shop_id pointer working, so we never hard-delete the row. Branches with
-- branch_deleted_at IS NOT NULL are hidden from the owner's switcher and
-- from the marketplace, but their data stays intact for reports.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_deleted_at TIMESTAMPTZ;

-- Index for the common "list my branches" query — only active rows.
CREATE INDEX IF NOT EXISTS users_active_branches_idx
  ON users (parent_shop_id)
  WHERE parent_shop_id IS NOT NULL AND branch_deleted_at IS NULL;
