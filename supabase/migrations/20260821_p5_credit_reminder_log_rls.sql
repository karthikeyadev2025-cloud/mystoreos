-- ═══════════════════════════════════════════════════════════════════════
-- P5 — RLS on credit_reminder_log
--
-- Every table in this schema has RLS enabled except one.
-- credit_reminder_log was added in 20260718_credit_payment_reminders.sql
-- with a primary key and an index, and no ALTER TABLE ... ENABLE ROW
-- LEVEL SECURITY. 46 of 47 tables have it; this one was missed.
--
-- With RLS off, the table is fully readable and writable by anyone
-- holding the anon key — which ships in the client bundle, so in
-- practice by anyone at all.
--
-- WHAT THAT EXPOSES
--
-- Read: the table is (credit_id, sent_at). Joined against credits — or
-- simply enumerated — it reveals which shops are behind on payment,
-- across every tenant, and how often they are being chased. That is a
-- competitor's collections list. It also hands out credit_id values,
-- which is the exact ingredient the P4 row-scoped RPCs needed: a uuid
-- you were not supposed to have.
--
-- Write: worse, and easier to overlook. send-payment-reminders uses this
-- table for idempotency — it reads which credits were already chased and
-- skips them. DELETE the rows and every overdue customer gets messaged
-- again on the next run. Repeat it and you have an unbounded WhatsApp and
-- SMS send at the operator's expense, aimed at their own customers, with
-- no rate limit in the way. INSERT is the mirror image: fabricate rows and
-- reminders stop going out at all, silently.
--
-- The Edge Function uses the service-role key, which bypasses RLS, so no
-- legitimate caller needs client access to this table.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.credit_reminder_log ENABLE ROW LEVEL SECURITY;

-- Deliberately no permissive policy. RLS with zero policies denies
-- everything for normal roles, which is exactly right here: the only
-- writer is the service-role Edge Function and it is not subject to RLS.
-- Adding a policy would only widen the surface.
--
-- One read policy, so the shop-side UI can show "last reminded on" for a
-- credit the caller can already see. Scoped through the parent credit
-- rather than by any id passed in.
DROP POLICY IF EXISTS crl_read_own ON public.credit_reminder_log;
CREATE POLICY crl_read_own ON public.credit_reminder_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_reminder_log.credit_id
        AND (
          public.owns_shop(c.to_shop_id)
          OR c.from_id = public.current_profile_id()
          OR public.current_user_role() = 'admin'
        )
    )
  );

COMMENT ON TABLE public.credit_reminder_log IS
  'Idempotency log for send-payment-reminders. RLS enabled 20260821 (P5) — '
  'it was the only table in the schema without it. Written exclusively by the '
  'service-role Edge Function; clients get SELECT only, and only for credits '
  'they can already see. Do not add INSERT/UPDATE/DELETE policies: client '
  'writes here let a caller suppress or replay reminder sends.';


-- ─── Verification ────────────────────────────────────────────────────
-- Fails loudly if a future migration turns RLS back off, or if someone
-- adds a write policy to this table.
DO $verify$
DECLARE
  v_rls   boolean;
  v_write int;
BEGIN
  SELECT relrowsecurity INTO v_rls
    FROM pg_class WHERE oid = 'public.credit_reminder_log'::regclass;

  IF NOT v_rls THEN
    RAISE EXCEPTION 'P5: RLS is not enabled on credit_reminder_log';
  END IF;

  SELECT count(*) INTO v_write
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'credit_reminder_log'
     AND cmd <> 'SELECT';

  IF v_write > 0 THEN
    RAISE WARNING 'P5: credit_reminder_log has % non-SELECT policy(ies) — client writes here can suppress or replay reminders', v_write;
  END IF;
END
$verify$;


-- ─── Schema-wide guard ───────────────────────────────────────────────
-- The gap was not that this table is special; it is that nothing checked.
-- This reports any table in public without RLS, so the next one is caught
-- at migration time rather than by an audit a year later.
DO $sweep$
DECLARE
  t record;
  n int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND c.relkind = 'r'
       AND NOT c.relrowsecurity
     ORDER BY c.relname
  LOOP
    RAISE WARNING 'P5 sweep: table public.% has RLS DISABLED', t.relname;
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE NOTICE 'P5 sweep: every table in public has RLS enabled';
  ELSE
    RAISE WARNING 'P5 sweep: % table(s) without RLS — review each', n;
  END IF;
END
$sweep$;


SELECT 'P5 credit_reminder_log RLS installed' AS status;
