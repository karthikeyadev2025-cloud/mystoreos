-- ═══════════════════════════════════════════════════════════════════════
-- Auto payment reminders — explicitly promised on the Pro Distributor
-- plan (pricing page: "Auto payment reminders") but had zero
-- implementation. Only manual Call/WhatsApp buttons existed in Route
-- Planner — nothing automatic at all.
--
-- Same idempotency pattern already proven for booking reminders
-- (send-booking-reminders / reminder_log), adapted for credits: a log
-- table records when a reminder was last sent for a given credit, so
-- a daily cron run never re-reminds the same outstanding balance more
-- than once every 7 days.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.credit_reminder_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id  uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_reminder_log_credit ON public.credit_reminder_log(credit_id, sent_at);

SELECT 'credit_reminder_log table installed' AS status;
