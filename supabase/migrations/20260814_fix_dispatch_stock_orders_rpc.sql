-- Migration 20260814: Resilient Fix for dispatch_stock_orders RPC and Schema Cache Reload
CREATE OR REPLACE FUNCTION public.dispatch_stock_orders(p_order_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatched integer;
BEGIN
  WITH updated AS (
    UPDATE public.stock_orders
    SET status = 'dispatched', dispatched_at = now()
    WHERE id = ANY(p_order_ids)
      AND (status = 'accepted' OR status = 'pending')
    RETURNING id
  )
  SELECT count(*) INTO v_dispatched FROM updated;

  RETURN jsonb_build_object(
    'dispatched', coalesce(v_dispatched, 0),
    'requested', coalesce(array_length(p_order_ids, 1), 0)
  );
END;
$$;

-- Grant execution to all active roles
GRANT EXECUTE ON FUNCTION public.dispatch_stock_orders(uuid[]) TO authenticated, anon, service_role;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'dispatch_stock_orders RPC fixed and reloaded' AS status;
