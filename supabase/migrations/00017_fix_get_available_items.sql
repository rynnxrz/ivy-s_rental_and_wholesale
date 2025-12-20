-- Fix operator does not exist: timestamp with time zone + integer
-- By converting integer buffer to interval

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
  -- 
  -- Using half-open interval [start, end):
  -- - A reservation on Dec 1-3 occupies Dec 1, 2 (end date Dec 3 is exclusive)
  -- - With 1-day buffer, Dec 3 is also blocked, so next available is Dec 4
  --
  -- Conflict exists if:
  --   requested_start < existing_end + buffer AND requested_end > existing_start
  RETURN QUERY
  SELECT i.* FROM items i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.item_id = i.id
        AND r.status IN ('confirmed', 'active')
        -- Fix: Convert integer buffer to interval
        AND p_start_date < (r.end_date + (v_buffer * INTERVAL '1 day'))
        AND p_end_date > r.start_date
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_items(DATE, DATE) TO anon, authenticated, service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
