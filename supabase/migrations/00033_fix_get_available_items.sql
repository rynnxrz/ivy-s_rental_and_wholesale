-- Fix get_available_items buffer arithmetic (use interval instead of integer)
CREATE OR REPLACE FUNCTION get_available_items(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS SETOF items AS $$
DECLARE
  v_buffer INTEGER;
BEGIN
  -- Get turnaround buffer from settings (default 1 day)
  SELECT COALESCE(turnaround_buffer, 1) INTO v_buffer
  FROM app_settings
  LIMIT 1;
  
  -- If no settings found, use default
  IF v_buffer IS NULL THEN
    v_buffer := 1;
  END IF;

  -- Return items where:
  -- 1. Item is active
  -- 2. No overlapping confirmed/active reservations exist
  -- 3. Buffer period after existing reservations is respected
  -- Conflict exists if:
  --   requested_start < existing_end + buffer AND requested_end > existing_start
  RETURN QUERY
  SELECT i.* FROM items i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.item_id = i.id
        AND r.status IN ('confirmed', 'active')
        AND p_start_date < (r.end_date + (v_buffer * INTERVAL '1 day'))
        AND p_end_date > r.start_date
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Re-apply execute grant and search_path hardening
GRANT EXECUTE ON FUNCTION get_available_items(DATE, DATE) TO anon, authenticated, service_role;
ALTER FUNCTION public.get_available_items(DATE, DATE) SET search_path = public, pg_temp;

-- Reload schema
NOTIFY pgrst, 'reload schema';
