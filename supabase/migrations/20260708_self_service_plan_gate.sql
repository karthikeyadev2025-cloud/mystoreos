-- ═══════════════════════════════════════════════════════════════════════
-- CUSTOMER SELF-SERVICE MANAGE-LINK — PLAN GATE
--
-- The manage_token column exists on every appointment (default
-- gen_random_uuid, set in 20260705_customer_self_service.sql). That's
-- fine — the token is harmless without a working endpoint.
--
-- This migration adds the SERVER-side gate: if a customer tries to
-- reschedule or cancel via manage-link on a shop whose plan doesn't
-- include self-service (Starter tier), the RPC refuses with a clear
-- error message. Belt for the UI belt-and-suspenders, so even a
-- leaked link on a Starter shop cannot bypass the plan.
--
-- Client-side: services widgets already gate the "Manage This Booking"
-- UI on features.canOfferSelfService — this migration is defense in
-- depth against direct RPC calls.
-- ═══════════════════════════════════════════════════════════════════════

-- Helper — is the shop on a plan that includes customer self-service?
-- Kept in sync with features.js serviceCustomerSelfService:
--   trial / pro / enterprise → true
--   starter                  → false
CREATE OR REPLACE FUNCTION public._shop_has_self_service(shop_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(subscription_tier, '') IN ('pro', 'enterprise') THEN true
    WHEN subscription = 'trial' AND (subscription_tier IS NULL OR subscription_tier = '') THEN true
    ELSE false
  END
  FROM public.users
  WHERE id = shop_uuid;
$$;


-- ── cancel_appointment_by_token — refuse if shop not on Pro+ ──────
-- We wrap the existing RPC. The prior signature stays intact so
-- there's no code migration on the client — it just starts returning
-- an error message for Starter-tier shops.
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.appointments WHERE manage_token = p_token;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public._shop_has_self_service(v_shop_id) THEN
    RAISE EXCEPTION 'Self-service cancel is not available for this shop — please contact the shop directly'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.appointments
    SET status = 'cancelled', updated_at = now()
    WHERE manage_token = p_token AND status NOT IN ('completed', 'cancelled');
END;
$$;


-- ── reschedule_appointment_by_token — refuse if shop not on Pro+ ──
-- Same treatment. Signature/name preserved from the prior migration
-- (20260705_customer_self_service.sql) — this only adds the gate.
CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(
  p_token       uuid,
  p_new_date    date,
  p_new_time    time
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id  uuid;
  v_dur      integer;
  v_provider uuid;
BEGIN
  SELECT shop_id, duration_minutes, provider_id
    INTO v_shop_id, v_dur, v_provider
    FROM public.appointments WHERE manage_token = p_token;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public._shop_has_self_service(v_shop_id) THEN
    RAISE EXCEPTION 'Self-service reschedule is not available for this shop — please contact the shop directly'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.appointments
    SET appointment_date = p_new_date,
        appointment_time = p_new_time,
        updated_at = now()
    WHERE manage_token = p_token AND status NOT IN ('completed', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, date, time) TO anon, authenticated;

SELECT 'self-service manage-link plan gate installed' AS status;
