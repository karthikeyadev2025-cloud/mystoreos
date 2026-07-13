-- ═══════════════════════════════════════════════════════════════════════
-- GAP 1: Shop ↔ Distributor linking — zero notification existed.
-- Either party can enter the other's code (created_by tracks who
-- actually did it) — the party who DIDN'T take the action is the one
-- who benefits from being told "someone just connected with you".
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_shop_distributor_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  shop_name text;
  dist_name text;
BEGIN
  SELECT name INTO shop_name FROM public.users WHERE id = NEW.shop_id;
  SELECT name INTO dist_name FROM public.users WHERE id = NEW.distributor_id;

  -- Notify the distributor, unless they were the one who entered the
  -- code (in which case they already know — no point telling someone
  -- something they just did themselves).
  IF NEW.created_by IS DISTINCT FROM NEW.distributor_id THEN
    PERFORM public.push_notification(
      NEW.distributor_id, 'info',
      'New shop connected',
      COALESCE(shop_name, 'A shop') || ' linked with you and can now see your wholesale catalogue and place stock orders.',
      '/distributor?tab=shops',
      jsonb_build_object('link_id', NEW.id, 'shop_id', NEW.shop_id)
    );
  END IF;

  -- Same for the shop, unless they initiated it.
  IF NEW.created_by IS DISTINCT FROM NEW.shop_id THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'info',
      'Distributor connected',
      COALESCE(dist_name, 'A distributor') || ' is now linked — you can browse their catalogue and place stock orders.',
      '/shop?tab=restock',
      jsonb_build_object('link_id', NEW.id, 'distributor_id', NEW.distributor_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_shop_distributor_links ON public.shop_distributor_links;
CREATE TRIGGER notify_shop_distributor_links
  AFTER INSERT ON public.shop_distributor_links
  FOR EACH ROW EXECUTE FUNCTION public.notify_shop_distributor_link();

SELECT 'shop-distributor link notification installed' AS status;

-- ═══════════════════════════════════════════════════════════════════════
-- GAP 2: Low-stock alerts — zero warning existed when a product hit
-- its reorder point. A shop owner found out they were out of stock
-- only when a customer couldn't buy it, or when they happened to
-- notice during a manual check.
--
-- Fires exactly once at the moment stock CROSSES from above the
-- reorder level to at-or-below it — not on every subsequent sale
-- while it stays low (which would mean a notification on every single
-- bill for a popular low-stock item, quickly becoming noise nobody
-- reads). If the product gets restocked above the threshold and later
-- drops below it again, that's a genuinely new low-stock event and
-- correctly fires again — this is a per-UPDATE comparison, not a
-- one-time flag.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_low_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.stock > OLD.reorder_level) AND (NEW.stock <= NEW.reorder_level) AND NEW.reorder_level > 0 THEN
    PERFORM public.push_notification(
      NEW.shop_id, 'info',
      'Low stock: ' || NEW.name,
      'Only ' || NEW.stock || ' left (reorder point: ' || NEW.reorder_level || '). Restock soon to avoid running out.',
      '/shop?tab=products',
      jsonb_build_object('product_id', NEW.id, 'stock', NEW.stock, 'reorder_level', NEW.reorder_level)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_low_stock_trigger ON public.products;
CREATE TRIGGER notify_low_stock_trigger
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

SELECT 'low stock notification installed' AS status;

