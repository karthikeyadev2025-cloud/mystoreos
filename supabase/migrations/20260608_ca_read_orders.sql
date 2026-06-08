-- ============================================================
-- CA (Chartered Accountant) read access to client orders
--
-- Bug found during testing: the CA Portal lets an accountant pick a client
-- shop and view its books / export GSTR-1, but orders_read_shop only allowed
-- the owning shop or an admin. The 'ca' role got zero rows, so every client
-- showed ₹0 revenue / 0 invoices — the entire CA portal was non-functional.
--
-- Fix: allow the 'ca' role to SELECT orders (read-only). CAs are trusted
-- accountants who need to see client sales to file returns. They get no
-- write access — only the existing owner/admin can modify orders.
-- ============================================================

DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
CREATE POLICY "orders_read_shop" ON public.orders
  FOR SELECT
  USING (
    shop_id = public.current_profile_id()
    OR user_id = public.current_profile_id()::text
    OR public.current_user_role() IN ('admin', 'ca')
  );

-- CA may also need to read shop products for line-item context in some views.
-- products already has a public read policy, so no change needed there.

SELECT 'CA can now read client shop orders' AS status;

-- ============================================================
-- CRITICAL SECURITY FIX: prevent privilege escalation via self-update
--
-- users_update_own lets a user update their own row (name, logo, upi, etc.)
-- but it placed NO restriction on which columns — so any logged-in user
-- could PATCH their own role to 'admin' or flip status to 'active',
-- bypassing approval and gaining full platform access.
-- Verified exploitable in testing.
--
-- Fix: a BEFORE UPDATE trigger that blocks changes to role / status / phone
-- unless the caller is an admin. Admins (current_user_role() = 'admin') and
-- the service role (used by edge functions, bypasses RLS+triggers? no —
-- triggers still run, so we allow when the role is being set by an admin OR
-- when auth.uid() is null which indicates service-role/edge context).
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Allow if performed by an admin
  IF public.current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Allow service-role / edge-function context (no JWT user)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- For everyone else: role, status and phone must not change
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not allowed to change status';
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'Not allowed to change phone';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.users;
CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

SELECT 'Privilege-escalation trigger installed: non-admins cannot change role/status/phone' AS status2;
