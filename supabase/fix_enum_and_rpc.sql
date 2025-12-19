-- 1. Fix the ENUM type by adding 'active' if it doesn't exist
-- Note: 'ALTER TYPE ... ADD VALUE IF NOT EXISTS' is supported in newer Postgres versions.
-- If you are on an older version and this fails, remove 'IF NOT EXISTS'.
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'active';

-- 2. Re-create the function to ensure it uses the updated enum
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
      -- Now that 'active' is in the enum, this check is valid
      AND status IN ('confirmed', 'active')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
