-- ============================================================
-- CRITICAL: stop users from self-granting paid plans without paying
--
-- The prevent_privilege_escalation trigger protected role/status/phone, but
-- NOT the billing columns. A shop could PATCH their own row with
-- subscription_tier='enterprise', subscription='active',
-- plan_expires_at='2099-...' from the browser and unlock every paid feature
-- for free — the payment was never enforced server-side for the grant.
--
-- The legitimate upgrade path is the razorpay-verify-payment edge function,
-- which runs as the service role (auth.uid() IS NULL) after verifying the
-- Razorpay signature, and is already exempt below. Admins can also adjust
-- plans manually. Everyone else is now blocked from changing these columns.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Admin may change anything
  IF public.current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Service-role / edge-function context (no JWT user) — e.g. payment verify
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Everyone else: these columns are immutable from the client
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not allowed to change status';
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'Not allowed to change phone';
  END IF;
  -- Billing columns: only the payment edge function / admin may change these
  IF NEW.subscription IS DISTINCT FROM OLD.subscription THEN
    RAISE EXCEPTION 'Not allowed to change subscription';
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Not allowed to change subscription tier';
  END IF;
  IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
    RAISE EXCEPTION 'Not allowed to change plan expiry';
  END IF;
  IF NEW.distributor_plan_tier IS DISTINCT FROM OLD.distributor_plan_tier THEN
    RAISE EXCEPTION 'Not allowed to change distributor plan';
  END IF;

  RETURN NEW;
END;
$$;

SELECT 'billing columns now protected — only payment edge fn / admin can grant plans' AS status;
