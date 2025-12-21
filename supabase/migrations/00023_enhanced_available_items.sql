-- Create a new function that returns items with availability status
-- This allows fetching both available and booked items in a single call
-- Returns items that are 'active'. Booked items are marked with is_booked=true.

CREATE OR REPLACE FUNCTION get_available_items_v2(
  p_start_date DATE,
  p_end_date DATE,
  p_include_booked BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rental_price NUMERIC,
  image_paths TEXT[],
  category TEXT,
  status TEXT,
  color TEXT,
  priority INTEGER,
  category_id UUID,
  collection_id UUID,
  is_booked BOOLEAN,
  conflict_dates TEXT
) AS $$
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

  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.rental_price,
    i.image_paths,
    i.category,
    i.status,
    i.color,
    i.priority,
    i.category_id,
    i.collection_id,
    (COUNT(r.id) > 0) as is_booked,
    STRING_AGG(TO_CHAR(r.start_date, 'Mon DD') || ' - ' || TO_CHAR(r.end_date, 'Mon DD'), ', ') as conflict_dates
  FROM items i
  LEFT JOIN reservations r ON i.id = r.item_id 
    AND r.status IN ('confirmed', 'active')
    AND p_start_date < (r.end_date + (v_buffer * INTERVAL '1 day'))
    AND p_end_date > r.start_date
  WHERE i.status = 'active'
  GROUP BY i.id, i.name, i.rental_price, i.image_paths, i.category, i.status, i.color, i.priority, i.category_id, i.collection_id
  HAVING p_include_booked OR COUNT(r.id) = 0
  ORDER BY i.priority DESC NULLS LAST, i.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_items_v2(DATE, DATE, BOOLEAN) TO anon, authenticated, service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
