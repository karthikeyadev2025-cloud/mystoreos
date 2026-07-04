-- ─────────────────────────────────────────────────────────────────────────
-- business_kind: signup-time hard split between Retail and Service dashboards
-- Only meaningful when role='shop'. Distributor/customer accounts stay as-is.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_kind TEXT
    CHECK (business_kind IN ('retail','service'));

-- Backfill existing shops to 'retail' — safe default; owners can request
-- a switch via super admin if they need Bookings-first later.
UPDATE public.users
  SET business_kind = 'retail'
  WHERE role = 'shop' AND business_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_business_kind ON public.users(business_kind);

SELECT 'business_kind column added to users table' AS status;
