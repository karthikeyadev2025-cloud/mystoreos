-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 1b — atomic vehicle provisioning
--
-- Creating a van is four related inserts: its warehouse (type='van'),
-- the vehicle row, and its two document series (invoice + credit note).
-- Doing these client-side in sequence risks orphans — a failure after
-- step 1 leaves a phantom warehouse with no vehicle, which then shows
-- up in stock reports forever.
--
-- SAFETY: additive only. New function on new tables from Phase 1.
-- Nothing existing is touched.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_field_vehicle(
  p_distributor_id uuid,
  p_code           text,
  p_name           text,
  p_registration   text DEFAULT NULL,
  p_parent_wh_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wh_id      uuid;
  v_vehicle_id uuid;
  v_code       text := upper(trim(p_code));
BEGIN
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Vehicle code is required';
  END IF;

  -- The van's own stock ledger.
  INSERT INTO public.warehouses (distributor_id, name, type, parent_warehouse_id)
    VALUES (p_distributor_id, COALESCE(NULLIF(trim(p_name), ''), v_code), 'van', p_parent_wh_id)
    RETURNING id INTO v_wh_id;

  INSERT INTO public.vehicles (distributor_id, warehouse_id, code, registration_no)
    VALUES (p_distributor_id, v_wh_id, v_code, NULLIF(trim(p_registration), ''))
    RETURNING id INTO v_vehicle_id;

  -- Disjoint document series so this van can bill offline without ever
  -- colliding with another van's numbering.
  INSERT INTO public.van_document_series (distributor_id, vehicle_id, doc_type, prefix)
    VALUES
      (p_distributor_id, v_vehicle_id, 'invoice',     'INV-' || v_code || '-'),
      (p_distributor_id, v_vehicle_id, 'credit_note', 'CRN-' || v_code || '-');

  RETURN v_vehicle_id;
END;
$$;

SELECT 'create_field_vehicle() installed' AS status;
