-- Add turnaround_buffer column to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS turnaround_buffer INTEGER DEFAULT 1 NOT NULL;

-- Update the check_item_availability function to include buffer
-- Logic: An item is unavailable if the requested range overlaps with:
-- ANY existing reservation's interval extended by the buffer days.
-- Effectively: [ExistingStart, ExistingEnd + Buffer]
CREATE OR REPLACE FUNCTION check_item_availability(
  p_item_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_buffer INTEGER;
BEGIN
  -- Fetch global buffer setting, default to 1 if not found
  SELECT turnaround_buffer INTO v_buffer FROM app_settings LIMIT 1;
  IF v_buffer IS NULL THEN
    v_buffer := 1;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE item_id = p_item_id
      AND status IN ('confirmed', 'active')
      -- Overlap Logic with Buffer:
      -- Existing Effective End = end_date + v_buffer
      -- Overlap if: (StartA <= EndB_Effective) and (EndA >= StartB)
      AND (start_date <= p_end_date)
      AND ((end_date + v_buffer) >= p_start_date)
      
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;
