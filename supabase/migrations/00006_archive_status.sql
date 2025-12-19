-- ============================================================
-- Migration: Add 'archived' status to reservations
-- Purpose: Allow archiving reservations to release dates
-- ============================================================

-- 1. Add 'archived' to the reservation_status ENUM type
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Create restore_reservation RPC function
-- Attempts to restore an archived reservation to 'confirmed' status
-- Only succeeds if the dates are still available
CREATE OR REPLACE FUNCTION restore_reservation(p_reservation_id UUID)
RETURNS JSON AS $$
DECLARE
  v_reservation RECORD;
  v_is_available BOOLEAN;
BEGIN
  -- Get the reservation
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;
  
  IF v_reservation.status != 'archived' THEN
    RETURN json_build_object('success', false, 'error', 'Only archived reservations can be restored');
  END IF;
  
  -- Check if dates are available (exclude this reservation from check)
  SELECT check_item_availability(
    v_reservation.item_id,
    v_reservation.start_date::DATE,
    v_reservation.end_date::DATE,
    p_reservation_id
  ) INTO v_is_available;
  
  IF NOT v_is_available THEN
    RETURN json_build_object('success', false, 'error', 'Dates are no longer available. Another reservation occupies this time slot.');
  END IF;
  
  -- Restore the reservation
  UPDATE reservations SET status = 'confirmed' WHERE id = p_reservation_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION restore_reservation(UUID) TO authenticated;
