-- ═══════════════════════════════════════════════════════════════════════
-- P6 — Two live RLS gaps
--
-- Both are cases where a later, correct policy was added but the earlier
-- permissive one was never dropped. In Postgres, multiple PERMISSIVE
-- policies for the same command are OR'd together, so the loosest one
-- wins and the correct one has no effect. Both look fixed in the
-- migration history and are not.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. orders_insert_any — WITH CHECK (true) on orders ──────────────
--
-- 20260521_v4_foundations.sql created:
--     CREATE POLICY "orders_insert_any" ON public.orders
--       FOR INSERT WITH CHECK (true);
--
-- 20260622_branch_rls_all_tables.sql then added the correct one:
--     CREATE POLICY "orders_insert_shop" ON public.orders
--       FOR INSERT WITH CHECK (public.owns_shop(shop_id));
--
-- but never dropped the first. 20260608_drop_open_policies.sql swept
-- orders_read_all and orders_update_all and missed orders_insert_any.
-- So owns_shop() is OR'd with true and the INSERT path is open.
--
-- What that costs: every protection on order creation lives inside
-- place_order_atomic — the server-side price check from P0, the atomic
-- stock decrement from P1, the "is this actually your order" check. A
-- direct supabase.from('orders').insert({...}) skips all of it and lands
-- a row with any shop_id, any total, any items. The P0 migration's own
-- comment names this policy as how a tampered order "lands".
--
-- Dropping it is safe: place_order_atomic is SECURITY DEFINER, so it
-- bypasses RLS entirely and the anonymous checkout path is unaffected.
-- No client code inserts into orders directly — the RPC is the only
-- writer.

DROP POLICY IF EXISTS "orders_insert_any" ON public.orders;

-- Re-assert the intended policy in case it was never applied.
DROP POLICY IF EXISTS "orders_insert_shop" ON public.orders;
CREATE POLICY "orders_insert_shop" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_shop(shop_id));

COMMENT ON POLICY "orders_insert_shop" ON public.orders IS
  'Direct INSERT is limited to the shop that owns the row. Customers do '
  'NOT get a direct-insert path: an "or the row is mine" clause was tried '
  'and rejected, because a caller setting user_id to their own id can then '
  'name any shop_id and any total — which is the same price-tampering hole '
  'the open policy left, just one step narrower. Customer checkout goes '
  'through place_order_atomic, which is SECURITY DEFINER, bypasses RLS and '
  'does the price check and stock decrement.';


-- ─── 2. appointments — customer PII readable by any logged-in user ───
--
-- 20260705_appointments_privacy_fix.sql found the appointments table
-- fully readable by anonymous visitors and fixed it properly FOR ANON:
--
--     REVOKE SELECT ON public.appointments FROM anon;
--     GRANT SELECT (id, shop_id, appointment_date, appointment_time,
--                   duration_minutes, status) ON public.appointments TO anon;
--     CREATE POLICY "appointments_public_slot_check"
--       ON public.appointments FOR SELECT USING (true);
--
-- The reasoning was right and the column GRANT does hold — for anon.
-- But the policy has no TO clause, so it applies to EVERY role, and
-- 20260702_service_booking.sql line 85 had already granted:
--
--     GRANT ALL ON public.services, public.appointments TO authenticated;
--
-- authenticated therefore has every column, and USING (true) gives it
-- every row. Any logged-in account — a customer of one shop, a
-- distributor, a competing shop owner, anyone who can register — can
-- read customer_name, customer_phone, service_name and notes for every
-- appointment at every shop on the platform.
--
-- This is the exact leak the migration set out to close. It was closed
-- for the anonymous case and left open for the authenticated one, which
-- is the easier of the two to exploit: registration is free.
--
-- The fix keeps slot-checking working. Anon is unchanged. authenticated
-- now sees only its own shop's rows (via the existing owner policy) or
-- its own bookings; slot availability moves to get_booked_slots() below,
-- which is SECURITY DEFINER and returns times only.

DROP POLICY IF EXISTS "appointments_public_slot_check" ON public.appointments;

-- Anon: unchanged behaviour. The column GRANT from 20260705 is what
-- makes this safe, and it is still in force — anon can reach only the
-- six non-identifying columns.
CREATE POLICY "appointments_slot_check_anon" ON public.appointments
  FOR SELECT TO anon
  USING (true);

COMMENT ON POLICY "appointments_slot_check_anon" ON public.appointments IS
  'Row-level open, column-level restricted. Safe ONLY because SELECT on '
  'this table is revoked from anon and re-granted for six non-identifying '
  'columns (20260705). If that GRANT is ever widened, this policy leaks '
  'customer PII to the public internet.';

-- Authenticated customers: their own bookings, matched on the phone
-- number attached to their account. Shop owners and staff keep full
-- access through the existing appointments_owner_all policy.
CREATE POLICY "appointments_own_bookings" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    customer_phone IS NOT NULL
    AND customer_phone = (
      SELECT u.phone FROM public.users u WHERE u.id = public.current_profile_id()
    )
  );


-- ─── 3. get_booked_slots — slot availability without the PII ─────────
--
-- Replaces the direct table read that getBookedSlots() and
-- checkAppointmentConflict() were doing. Returns start time and
-- duration only, so double-booking prevention keeps working for logged-in
-- customers without handing them the table.
--
-- Cancelled appointments are excluded here rather than by the caller, so
-- a caller cannot forget to.

CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_shop_id     uuid,
  p_date        date,
  p_provider_id uuid DEFAULT NULL
)
RETURNS TABLE (appointment_time time, duration_minutes integer, id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.appointment_time, a.duration_minutes, a.id
    FROM public.appointments a
   WHERE a.appointment_date = p_date
     AND a.status IS DISTINCT FROM 'cancelled'
     AND (
       (p_provider_id IS NOT NULL AND a.provider_id = p_provider_id)
       OR
       (p_provider_id IS NULL AND a.shop_id = p_shop_id AND a.provider_id IS NULL)
     );
$$;

COMMENT ON FUNCTION public.get_booked_slots(uuid, date, uuid) IS
  'Slot availability for the booking widget. Returns time and duration '
  'only — never customer_name, customer_phone, service_name or notes. '
  'SECURITY DEFINER so it works for anon and authenticated callers '
  'without either needing SELECT on the appointments table.';

REVOKE ALL ON FUNCTION public.get_booked_slots(uuid, date, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date, uuid) TO anon, authenticated;


SELECT 'P6 RLS gap fixes installed' AS status;
