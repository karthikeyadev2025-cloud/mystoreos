-- ═══════════════════════════════════════════════════════════════════════
-- URGENT — run this immediately if you haven't already.
--
-- notify_credit_events() referenced NEW.shop_id — a column that does
-- not exist on public.credits. The real columns are from_id and
-- to_shop_id (confirmed by reading every actual INSERT the app
-- performs against this table). This is not a display bug or a
-- reporting gap like several others found tonight — this is a hard
-- SQL error thrown on every single INSERT or "mark as paid" UPDATE
-- against public.credits, meaning every credit/khata ledger entry —
-- the core daily-use feature of this app — has been failing outright
-- since this trigger was installed.
--
-- Confirmed directly: reproduced the exact error on a real insert
-- ("record 'new' has no field 'shop_id'"), then confirmed this fix
-- resolves both the insert path and the mark-as-paid path.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_credit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.to_shop_id, 'credit',
      'Credit logged · ₹' || COALESCE(NEW.amount::text, '0'),
      COALESCE(NEW.description, 'New unpaid entry'),
      '/shop?tab=credit',
      jsonb_build_object('credit_id', NEW.id, 'amount', NEW.amount)
    );
  ELSIF (TG_OP = 'UPDATE') AND (OLD.paid IS DISTINCT FROM NEW.paid) AND NEW.paid = true THEN
    PERFORM public.push_notification(
      NEW.to_shop_id, 'credit',
      'Repayment received · ₹' || COALESCE(NEW.amount::text, '0'),
      'Marked as paid: ' || COALESCE(NEW.description, ''),
      '/shop?tab=credit',
      jsonb_build_object('credit_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'FIXED — credit/khata entries will no longer fail. NEW.shop_id -> NEW.to_shop_id' AS status;
