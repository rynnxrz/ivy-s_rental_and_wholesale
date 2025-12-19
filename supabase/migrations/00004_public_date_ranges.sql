-- ============================================================
-- Migration: Public Unavailable Date Ranges Function
-- Purpose: Allow anonymous users to see blocked dates on datepicker
-- without exposing full reservation data
-- ============================================================

-- Create a SECURITY DEFINER function that bypasses RLS
-- Only returns date ranges, no sensitive customer info
CREATE OR REPLACE FUNCTION get_unavailable_date_ranges(p_item_id UUID)
RETURNS TABLE (
  start_date DATE,
  end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.start_date::DATE,
    r.end_date::DATE
  FROM reservations r
  WHERE r.item_id = p_item_id
    AND r.status IN ('confirmed', 'active');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_unavailable_date_ranges(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_unavailable_date_ranges(UUID) TO authenticated;

COMMENT ON FUNCTION get_unavailable_date_ranges IS 
  'Returns date ranges that are unavailable for booking. Uses SECURITY DEFINER to bypass RLS, 
   exposing only dates (no customer info) for calendar display.';
