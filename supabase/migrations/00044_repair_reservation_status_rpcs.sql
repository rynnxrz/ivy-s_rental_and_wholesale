-- Repair reservation RPCs after environments were partially migrated to the
-- new reservation status enum values. Some production databases now store the
-- new labels ('Pending Request', 'Upcoming', 'Ongoing', 'Past-loan') while the
-- RPC bodies still compare against legacy literals ('confirmed', 'active').
-- Once status is an enum, those legacy comparisons throw:
--   invalid input value for enum reservation_status_new: "confirmed"

CREATE OR REPLACE FUNCTION check_item_availability(
  p_item_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM reservations
    WHERE item_id = p_item_id
      AND status::text IN ('Upcoming', 'Ongoing')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_available_items(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS SETOF items AS $$
DECLARE
  v_buffer INTEGER;
BEGIN
  SELECT COALESCE(turnaround_buffer, 1) INTO v_buffer
  FROM app_settings
  LIMIT 1;

  IF v_buffer IS NULL THEN
    v_buffer := 1;
  END IF;

  RETURN QUERY
  SELECT i.*
  FROM items i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.item_id = i.id
        AND r.status::text IN ('Upcoming', 'Ongoing')
        AND p_start_date < (r.end_date + (v_buffer * INTERVAL '1 day'))
        AND p_end_date > r.start_date
    );
END;
$$ LANGUAGE plpgsql STABLE;

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
    AND r.status::text IN ('Upcoming', 'Ongoing');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_reservation(p_reservation_id UUID)
RETURNS JSON AS $$
DECLARE
  v_reservation RECORD;
  v_is_available BOOLEAN;
BEGIN
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  IF v_reservation.status::text != 'Past-loan' THEN
    RETURN json_build_object('success', false, 'error', 'Only Past-loan reservations can be restored');
  END IF;

  SELECT check_item_availability(
    v_reservation.item_id,
    v_reservation.start_date::DATE,
    v_reservation.end_date::DATE,
    p_reservation_id
  ) INTO v_is_available;

  IF NOT v_is_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Dates are no longer available. Another reservation occupies this time slot.'
    );
  END IF;

  UPDATE reservations
  SET status = 'Upcoming'
  WHERE id = p_reservation_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_item_availability(UUID, DATE, DATE, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_available_items(DATE, DATE) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_unavailable_date_ranges(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_reservation(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
