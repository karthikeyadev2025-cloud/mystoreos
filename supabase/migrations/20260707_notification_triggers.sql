-- ═══════════════════════════════════════════════════════════════════════
-- EVENT → NOTIFICATION TRIGGERS
--
-- Each real event that matters gets a Postgres trigger that inserts
-- rows into public.notifications for the affected users. Because the
-- triggers run inside the same transaction as the event, notifications
-- can never fire for an event that got rolled back — no ghost pings.
--
-- Events covered:
--   • orders INSERT       → notify SHOP OWNER (new bill)
--   • orders status→Accepted → notify CUSTOMER
--   • appointments INSERT → notify SHOP OWNER (new booking)
--   • appointments status→cancelled → notify SHOP OWNER
--   • appointments status→confirmed → notify CUSTOMER (if they have an account)
--   • users role='shop' INSERT with status='pending' → notify all ADMINS
--   • credits INSERT             → notify SHOP OWNER (customer credit taken)
--   • credits paid true          → notify SHOP OWNER (repayment received)
--
-- Deliberately NOT covered here (best done from app or a scheduled job):
--   • Low-stock (needs a query, better done by a nightly cron)
--   • Trial expiring (already handled by expire-trials edge function)
--   • Support ticket opened (add later when tickets table exists)
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: insert a notification safely. Wrapped in a function so triggers
-- share one canonical shape. SECURITY DEFINER so triggers can insert
-- even when RLS would block the row's user_id from ever writing there.
CREATE OR REPLACE FUNCTION public.push_notification(
  p_user_id    uuid,
  p_category   text,
  p_title      text,
  p_body       text,
  p_action_url text DEFAULT NULL,
  p_data       jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, category, title, body, action_url, data)
  VALUES (p_user_id, p_category, p_title, p_body, p_action_url, p_data);
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the real business event.
  -- Log to Postgres server log; don't propagate.
  RAISE WARNING 'push_notification failed for user %: %', p_user_id, SQLERRM;
END;
$$;


-- ── ORDERS ─────────────────────────────────────────────────────────
-- New order → shop owner is told a bill was placed on their storefront.
-- Fires on INSERT regardless of source (POS bill vs public storefront) —
-- POS bills are useful in the notification history too ("what did I
-- sell today?"), and there's no per-source filter to worry about.
CREATE OR REPLACE FUNCTION public.notify_order_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'order',
      'New bill · ₹' || COALESCE(NEW.total::text, '0'),
      COALESCE(NEW.user_id, 'Walk-in customer') || ' · ' || COALESCE(NEW.status, 'Pending'),
      '/shop?tab=bills&order=' || NEW.id::text,
      jsonb_build_object('order_id', NEW.id, 'total', NEW.total, 'status', NEW.status)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Notify the customer when the shop moves their order to Accepted.
    -- Only if user_id looks like a UUID (some POS orders use walk-in strings).
    BEGIN v_customer_uuid := NEW.user_id::uuid; EXCEPTION WHEN OTHERS THEN v_customer_uuid := NULL; END;
    IF v_customer_uuid IS NOT NULL AND NEW.status = 'Accepted' THEN
      PERFORM public.push_notification(
        v_customer_uuid, 'order',
        'Order accepted',
        'Your order at the shop has been accepted.',
        '/user?tab=orders&order=' || NEW.id::text,
        jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_orders ON public.orders;
CREATE TRIGGER notify_orders
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_events();


-- ── APPOINTMENTS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_appointment_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_uuid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'booking',
      'New booking · ' || COALESCE(NEW.customer_name, 'Guest'),
      to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM')
        || ' · ' || COALESCE(NEW.service_name, 'Service'),
      '/shop?tab=bookings&appointment=' || NEW.id::text,
      jsonb_build_object('appointment_id', NEW.id, 'service', NEW.service_name, 'price', NEW.service_price)
    );

  ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'cancelled' THEN
      -- Someone cancelled — always tell the shop.
      PERFORM public.push_notification(
        NEW.shop_id, 'booking',
        'Booking cancelled · ' || COALESCE(NEW.customer_name, 'Guest'),
        to_char(NEW.appointment_date, 'DD Mon') || ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM'),
        '/shop?tab=bookings',
        jsonb_build_object('appointment_id', NEW.id)
      );
    ELSIF NEW.status = 'confirmed' THEN
      -- Try to notify the customer if we can find them by phone.
      SELECT id INTO v_customer_uuid FROM public.users
        WHERE phone = NEW.customer_phone AND role = 'customer' LIMIT 1;
      IF v_customer_uuid IS NOT NULL THEN
        PERFORM public.push_notification(
          v_customer_uuid, 'booking',
          'Booking confirmed',
          'Your appointment on ' || to_char(NEW.appointment_date, 'DD Mon') ||
          ' at ' || to_char(NEW.appointment_time, 'HH12:MI AM') || ' is confirmed.',
          NULL,
          jsonb_build_object('appointment_id', NEW.id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_appointments ON public.appointments;
CREATE TRIGGER notify_appointments
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_events();


-- ── CREDITS ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_credit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'credit',
      'Credit logged · ₹' || COALESCE(NEW.amount::text, '0'),
      COALESCE(NEW.description, 'New unpaid entry'),
      '/shop?tab=credit',
      jsonb_build_object('credit_id', NEW.id, 'amount', NEW.amount)
    );
  ELSIF (TG_OP = 'UPDATE') AND (OLD.paid IS DISTINCT FROM NEW.paid) AND NEW.paid = true THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'credit',
      'Repayment received · ₹' || COALESCE(NEW.amount::text, '0'),
      'Marked as paid: ' || COALESCE(NEW.description, ''),
      '/shop?tab=credit',
      jsonb_build_object('credit_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_credits ON public.credits;
CREATE TRIGGER notify_credits
  AFTER INSERT OR UPDATE OF paid ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.notify_credit_events();


-- ── NEW SHOP / DISTRIBUTOR PENDING APPROVAL → ALL ADMINS ─────────────
CREATE OR REPLACE FUNCTION public.notify_pending_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_row RECORD;
BEGIN
  IF (TG_OP = 'INSERT') AND NEW.status = 'pending' AND NEW.role IN ('shop', 'distributor') THEN
    FOR admin_row IN SELECT id FROM public.users WHERE role = 'admin' LOOP
      PERFORM public.push_notification(
        admin_row.id, 'signup',
        'New ' || NEW.role || ' pending approval',
        COALESCE(NEW.name, 'Unnamed') || ' · ' || COALESCE(NEW.phone, ''),
        '/admin?tab=shops&status=pending',
        jsonb_build_object('user_id', NEW.id, 'role', NEW.role)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_pending_signups ON public.users;
CREATE TRIGGER notify_pending_signups
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_pending_signup();

SELECT 'notification triggers installed' AS status;
