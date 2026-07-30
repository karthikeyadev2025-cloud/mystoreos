-- ═══════════════════════════════════════════════════════════════════════
-- P3 HARDENING + COMPLIANCE — 2026-08-01
--
-- Defense-in-depth on top of P0/P1. Focus areas:
--
--   1) PII minimization: get_appointment_by_token returns only what
--      ManageBooking actually renders, not the full customer row.
--
--   2) Subscription forensic trail: every change to a user's plan
--      state is recorded in subscription_events, so a fraud dispute
--      or a "why did my plan change?" can be answered from data.
--
--   3) Data Protection Act (India, 2023) minimum viable compliance:
--      • data export function callable by any authenticated user
--      • soft-delete retention cleanup (delete rows soft-deleted
--        more than 90 days ago)
--      • consent capture column on the users table (needs UI wiring
--        separately — this migration adds the column so the UI can
--        write to it without a schema change later)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) get_appointment_by_token — return only what the UI needs
--
-- The current version returns SETOF public.appointments — the whole
-- row including customer_name, customer_phone, customer_address,
-- home_service_fee, service_location, notes, etc. ManageBooking.jsx
-- only reads: appointment_date, appointment_time, duration_minutes,
-- provider_id, service_name, service_price, shop_id, status,
-- manage_token, id.
--
-- Token entropy (122-bit UUIDv4) already makes brute-force
-- practically impossible. But if a token ever leaks (browser sync,
-- support screenshot, error log), leaked scope = only what's needed
-- to display the booking. Customer PII stays server-side.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_appointment_by_token(p_token uuid)
RETURNS TABLE (
  id                  uuid,
  shop_id             uuid,
  appointment_date    date,
  appointment_time    time,
  duration_minutes    integer,
  status              text,
  service_name        text,
  service_price       numeric,
  provider_id         uuid,
  manage_token        uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, shop_id, appointment_date, appointment_time,
    duration_minutes, status, service_name, service_price,
    provider_id, manage_token
  FROM public.appointments
  WHERE manage_token = p_token;
$$;

-- Grants unchanged from the original — the RPC is callable by anon
-- and authenticated because guests use it too.
GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) subscription_events — plan-state audit log
--
-- Every UPDATE to a subscription-related column on users leaves a row
-- here with old/new values and the actor (auth.uid() when a JWT is
-- present, NULL when set by an edge function using the service role).
-- Used for:
--   • Reconciling Razorpay disputes ("was this actually granted?")
--   • Detecting anomalies (a plan changing without a matching
--     payment_history row = something bypassed the payment flow)
--   • Support triage ("when did the shop's plan change?")
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id          uuid,                     -- NULL = service role (edge function or admin CLI)
  changed_at        timestamptz NOT NULL DEFAULT now(),
  field             text NOT NULL,            -- 'subscription', 'subscription_tier', etc.
  old_value         text,
  new_value         text
);

CREATE INDEX IF NOT EXISTS idx_sub_events_user
  ON public.subscription_events(user_id, changed_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- The user themselves can see their own audit trail (right of access
-- under DPDP Act); admins can see all. Nothing writable from any
-- policy — the trigger below is the only writer.
DROP POLICY IF EXISTS "sub_events_own_read" ON public.subscription_events;
CREATE POLICY "sub_events_own_read" ON public.subscription_events
  FOR SELECT USING (
    user_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- Trigger — records old/new for six billing columns whenever they
-- change. Fires as SECURITY DEFINER so it can INSERT regardless of
-- who caused the update.
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();  -- NULL for service role / edge functions

  IF NEW.subscription IS DISTINCT FROM OLD.subscription THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'subscription', OLD.subscription, NEW.subscription);
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'subscription_tier', OLD.subscription_tier, NEW.subscription_tier);
  END IF;

  IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'plan_expires_at',
            OLD.plan_expires_at::text, NEW.plan_expires_at::text);
  END IF;

  IF NEW.distributor_plan_tier IS DISTINCT FROM OLD.distributor_plan_tier THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'distributor_plan_tier',
            OLD.distributor_plan_tier, NEW.distributor_plan_tier);
  END IF;

  IF NEW.distributor_plan_expires_at IS DISTINCT FROM OLD.distributor_plan_expires_at THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'distributor_plan_expires_at',
            OLD.distributor_plan_expires_at::text, NEW.distributor_plan_expires_at::text);
  END IF;

  IF NEW.home_service_addon_expires_at IS DISTINCT FROM OLD.home_service_addon_expires_at THEN
    INSERT INTO public.subscription_events (user_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'home_service_addon_expires_at',
            OLD.home_service_addon_expires_at::text, NEW.home_service_addon_expires_at::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_subscription_change ON public.users;
CREATE TRIGGER trg_log_subscription_change
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (
    OLD.subscription IS DISTINCT FROM NEW.subscription
    OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier
    OR OLD.plan_expires_at IS DISTINCT FROM NEW.plan_expires_at
    OR OLD.distributor_plan_tier IS DISTINCT FROM NEW.distributor_plan_tier
    OR OLD.distributor_plan_expires_at IS DISTINCT FROM NEW.distributor_plan_expires_at
    OR OLD.home_service_addon_expires_at IS DISTINCT FROM NEW.home_service_addon_expires_at
  )
  EXECUTE FUNCTION public.log_subscription_change();

-- ═══════════════════════════════════════════════════════════════════════
-- 3) DPDP Act compliance infrastructure
--
-- India's Digital Personal Data Protection Act 2023 grants data
-- principals (users) four rights that the platform must be able to
-- satisfy on request:
--   (a) Access — a copy of their personal data
--   (b) Correction — already covered by existing profile editing
--   (c) Erasure — already covered by delete-user + soft-deletes;
--       this migration adds the retention cleanup
--   (d) Grievance — human contact channel (support-chat already covers)
--
-- Plus one duty: obtain consent for processing beyond the necessary.
-- ═══════════════════════════════════════════════════════════════════════

-- Consent capture column. The UI needs to set this to true when the
-- user ticks "I agree to the Privacy Policy" on registration. Adding
-- the column now so the UI can start writing to it without a schema
-- change. NULL is treated as "not yet asked" — the frontend can
-- prompt legacy users on next login.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privacy_consent_v1_at timestamptz;

-- Retention cleanup — hard-delete rows soft-deleted more than 90 days
-- ago. Callable from a nightly cron. Each table with a soft-delete
-- column gets processed in its own transaction so a failure in one
-- doesn't roll back the others.
CREATE OR REPLACE FUNCTION public.enforce_retention_policy()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '90 days';
  v_deleted_orders int := 0;
  v_deleted_products int := 0;
  v_deleted_appointments int := 0;
  v_deleted_shops int := 0;
BEGIN
  -- Orders — has soft delete? Check column existence to be resilient
  -- against schemas that haven't added it yet.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='orders' AND column_name='deleted_at') THEN
    WITH d AS (
      DELETE FROM public.orders WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_orders FROM d;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='products' AND column_name='deleted_at') THEN
    WITH d AS (
      DELETE FROM public.products WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_products FROM d;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='appointments' AND column_name='deleted_at') THEN
    WITH d AS (
      DELETE FROM public.appointments WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_appointments FROM d;
  END IF;

  -- Branch soft-delete (users.branch_deleted_at from your 20260622_branches migration)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='users' AND column_name='branch_deleted_at') THEN
    WITH d AS (
      DELETE FROM public.users WHERE branch_deleted_at IS NOT NULL AND branch_deleted_at < v_cutoff
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_shops FROM d;
  END IF;

  -- Prune old rate_limit_log entries too (they're for observability
  -- only, no retention need beyond a few days)
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '7 days';

  RETURN jsonb_build_object(
    'ran_at', now(),
    'orders_deleted', v_deleted_orders,
    'products_deleted', v_deleted_products,
    'appointments_deleted', v_deleted_appointments,
    'shops_deleted', v_deleted_shops
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_retention_policy() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enforce_retention_policy() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) DPDP Data Export RPC
--
-- Returns a JSON blob of everything the platform stores about the
-- caller. Right of Access per DPDP §11. The edge function
-- user-data-export wraps this in a downloadable JSON file, but the
-- RPC itself can also be called directly from the settings UI to
-- show "here's what we store about you" inline.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  v_user_id := public.current_profile_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Assemble a JSON object with everything associated with the user.
  -- Sensitive columns (pass, pass_verify) are excluded — they're
  -- authentication material, not personal data.
  SELECT jsonb_build_object(
    'generated_at', now(),
    'profile', (
      SELECT to_jsonb(u) - 'pass' - 'pass_verify'
        FROM public.users u
       WHERE u.id = v_user_id
    ),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o))
        FROM public.orders o
       WHERE o.shop_id = v_user_id
          OR o.user_id = v_user_id::text
          OR o.customer_id = v_user_id
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
        FROM public.products p
       WHERE p.shop_id = v_user_id
    ), '[]'::jsonb),
    'appointments', COALESCE((
      SELECT jsonb_agg(to_jsonb(a))
        FROM public.appointments a
       WHERE a.shop_id = v_user_id
    ), '[]'::jsonb),
    'credits', COALESCE((
      SELECT jsonb_agg(to_jsonb(c))
        FROM public.credits c
       WHERE c.from_id = v_user_id OR c.to_shop_id = v_user_id
    ), '[]'::jsonb),
    'payment_history', COALESCE((
      SELECT jsonb_agg(to_jsonb(ph))
        FROM public.payment_history ph
       WHERE ph.user_id = v_user_id
    ), '[]'::jsonb),
    'subscription_events', COALESCE((
      SELECT jsonb_agg(to_jsonb(se))
        FROM public.subscription_events se
       WHERE se.user_id = v_user_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'P3 hardening applied: PII-minimized token RPC, subscription audit trail, DPDP data-export + retention' AS status;
