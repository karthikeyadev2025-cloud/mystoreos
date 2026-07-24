-- ═══════════════════════════════════════════════════════════════════════
-- Real partial payment tracking for credits — was completely missing.
-- credits.paid was only ever a boolean (fully paid or not at all), with
-- no way to record a shop paying down their balance in installments,
-- which is how real distributor/shop payment actually works. This adds
-- a proper payment-history table rather than just tracking a running
-- balance number, so a distributor can see exactly when each partial
-- payment came in — same as any real accounting ledger.
--
-- credits.paid is kept exactly as-is (unchanged meaning: "fully
-- settled") so every existing query/UI that already checks it keeps
-- working correctly. This adds to that, not replaces it — paid gets
-- set true automatically once total payments reach the full amount.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id    uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  amount       numeric NOT NULL CHECK (amount > 0),
  note         text,
  recorded_by  uuid REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_id ON public.credit_payments(credit_id);

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- Same access shape as the credits table itself: whoever is owed the
-- money (from_id on the credit) or whoever owes it (to_shop_id) can see
-- the payment history for that credit. Only the party OWED the money
-- can record a new payment — matching how markCreditPaid already works
-- today (the recipient confirms receipt, not the payer self-reporting).
DROP POLICY IF EXISTS "credit_payments_read" ON public.credit_payments;
CREATE POLICY "credit_payments_read" ON public.credit_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_payments.credit_id
        AND (public.owns_shop(c.from_id) OR public.owns_shop(c.to_shop_id))
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "credit_payments_write" ON public.credit_payments;
CREATE POLICY "credit_payments_write" ON public.credit_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_payments.credit_id
        AND public.owns_shop(c.from_id)
    )
  );

-- Recomputes and stamps credits.paid once total payments reach the
-- full amount — so every existing query that filters on paid=false
-- for "still outstanding" keeps working correctly without needing to
-- know about the new payments table at all.
CREATE OR REPLACE FUNCTION public.recompute_credit_paid_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_paid numeric;
  credit_amount numeric;
BEGIN
  SELECT amount INTO credit_amount FROM public.credits WHERE id = NEW.credit_id;
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.credit_payments WHERE credit_id = NEW.credit_id;
  IF total_paid >= credit_amount THEN
    UPDATE public.credits SET paid = true WHERE id = NEW.credit_id AND paid = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recompute_credit_paid_on_payment ON public.credit_payments;
CREATE TRIGGER recompute_credit_paid_on_payment
  AFTER INSERT ON public.credit_payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_credit_paid_status();

SELECT 'credit_payments table + RLS + auto paid-status trigger installed' AS status;
