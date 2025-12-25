-- Re-create the check_item_availability function to ensure it exists and arguments match
CREATE OR REPLACE FUNCTION check_item_availability(
  p_item_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE item_id = p_item_id
      AND status IN ('confirmed', 'active')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to everyone (or specific roles) just in case
GRANT EXECUTE ON FUNCTION check_item_availability(UUID, DATE, DATE, UUID) TO anon, authenticated, service_role;

-- Force schema cache reload (usually happens automatically but good to trigger a change)
NOTIFY pgrst, 'reload schema';
