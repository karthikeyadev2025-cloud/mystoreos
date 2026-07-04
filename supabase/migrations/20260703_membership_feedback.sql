-- ─────────────────────────────────────────────────────────────────────────
-- Stage 3: Membership plans, memberships, and customer feedback
--
-- Two new tables to enable membership subscriptions and feedback collection.
-- All shop-scoped, RLS enforced via current_user_shop_id() for consistency
-- with the products / orders / services pattern.
-- ─────────────────────────────────────────────────────────────────────────

-- Membership PLANS (what the shop offers)
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id                 UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id            UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name               TEXT    NOT NULL,
  description        TEXT,
  duration_days      INTEGER NOT NULL DEFAULT 30,   -- 30 = monthly, 90 = qtly, 365 = yearly
  price              NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent   INTEGER NOT NULL DEFAULT 0,    -- % off on every bill for member
  free_services      INTEGER NOT NULL DEFAULT 0,    -- eg 2 free haircuts / month
  color              TEXT    NOT NULL DEFAULT '#8B5CF6',
  active             BOOLEAN NOT NULL DEFAULT true,
  display_order      INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer MEMBERSHIPS (individual subscriptions to a plan)
CREATE TABLE IF NOT EXISTS public.memberships (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id               UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id               UUID    REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  plan_name             TEXT    NOT NULL,          -- denormalised (for history)
  plan_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  plan_discount_percent INTEGER NOT NULL DEFAULT 0,
  customer_name         TEXT    NOT NULL,
  customer_phone        TEXT    NOT NULL,
  starts_on             DATE    NOT NULL,
  expires_on            DATE    NOT NULL,
  services_used         INTEGER NOT NULL DEFAULT 0,
  status                TEXT    NOT NULL DEFAULT 'active', -- active | expired | cancelled
  notes                 TEXT,
  order_id              UUID    REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer FEEDBACK (post-visit surveys and general feedback)
CREATE TABLE IF NOT EXISTS public.feedback (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id               UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_name         TEXT,
  customer_phone        TEXT,
  rating                INTEGER NOT NULL,          -- 1..5
  comment               TEXT,
  order_id              UUID    REFERENCES public.orders(id) ON DELETE SET NULL,
  appointment_id        UUID    REFERENCES public.appointments(id) ON DELETE SET NULL,
  responded             BOOLEAN NOT NULL DEFAULT false,
  response_text         TEXT,
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback         ENABLE ROW LEVEL SECURITY;

-- membership_plans: shop-scoped writes; anon can read active plans
DROP POLICY IF EXISTS "mplans_owner_all"   ON public.membership_plans;
DROP POLICY IF EXISTS "mplans_public_read" ON public.membership_plans;
CREATE POLICY "mplans_owner_all" ON public.membership_plans
  FOR ALL USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());
CREATE POLICY "mplans_public_read" ON public.membership_plans
  FOR SELECT USING (active = true);

-- memberships: shop-scoped only
DROP POLICY IF EXISTS "memberships_owner_all" ON public.memberships;
CREATE POLICY "memberships_owner_all" ON public.memberships
  FOR ALL USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());

-- feedback: shop reads its own; anon can INSERT (public feedback form)
DROP POLICY IF EXISTS "feedback_owner_read"   ON public.feedback;
DROP POLICY IF EXISTS "feedback_owner_write"  ON public.feedback;
DROP POLICY IF EXISTS "feedback_public_insert" ON public.feedback;
CREATE POLICY "feedback_owner_read" ON public.feedback
  FOR SELECT USING (shop_id = public.current_user_shop_id());
CREATE POLICY "feedback_owner_write" ON public.feedback
  FOR UPDATE USING (shop_id = public.current_user_shop_id())
  WITH CHECK (shop_id = public.current_user_shop_id());
CREATE POLICY "feedback_public_insert" ON public.feedback
  FOR INSERT WITH CHECK (rating BETWEEN 1 AND 5);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_membership_plans_shop ON public.membership_plans(shop_id);
CREATE INDEX IF NOT EXISTS idx_memberships_shop      ON public.memberships(shop_id);
CREATE INDEX IF NOT EXISTS idx_memberships_phone     ON public.memberships(shop_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry    ON public.memberships(shop_id, expires_on);
CREATE INDEX IF NOT EXISTS idx_feedback_shop         ON public.feedback(shop_id, created_at DESC);

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT SELECT ON public.membership_plans TO anon;
GRANT INSERT ON public.feedback TO anon;
GRANT ALL ON public.membership_plans, public.memberships, public.feedback TO authenticated;

SELECT 'Membership + Feedback tables created' AS status;
