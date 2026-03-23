-- ============================================================
-- Reservation Status Refactor + Invoice Pricing Fields
-- ============================================================

-- 1) Invoice pricing fields for discount/deposit breakdown
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Backfill existing rows once
UPDATE invoices
SET
  subtotal_amount = COALESCE(total_amount, 0),
  discount_percentage = 0,
  discount_amount = 0,
  deposit_amount = 0
WHERE subtotal_amount = 0
  AND discount_percentage = 0
  AND discount_amount = 0
  AND deposit_amount = 0;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_discount_percentage_check;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subtotal_amount_check;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_discount_amount_check;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_deposit_amount_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_discount_percentage_check CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD CONSTRAINT invoices_subtotal_amount_check CHECK (subtotal_amount >= 0),
  ADD CONSTRAINT invoices_discount_amount_check CHECK (discount_amount >= 0),
  ADD CONSTRAINT invoices_deposit_amount_check CHECK (deposit_amount >= 0);

-- 2) Reservation signature URL
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_signature_url TEXT;

-- 3) Migrate reservation statuses to the new 4-state model
-- Drop legacy constraints/default first because older schemas may compare
-- TEXT status against enum literals and fail during UPDATE.
ALTER TABLE reservations
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlap_confirmed_active;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlap_upcoming_ongoing;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_item_id_tstzrange_excl;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reservation_status_new'
  ) THEN
    CREATE TYPE reservation_status_new AS ENUM (
      'Pending Request',
      'Upcoming',
      'Ongoing',
      'Past-loan'
    );
  END IF;
END $$;

-- Convert to text first so both enum/text legacy schemas are handled.
ALTER TABLE reservations
  ALTER COLUMN status TYPE TEXT USING status::text;

UPDATE reservations
SET status = CASE status::text
  WHEN 'Pending Request' THEN 'Pending Request'
  WHEN 'Upcoming' THEN 'Upcoming'
  WHEN 'Ongoing' THEN 'Ongoing'
  WHEN 'Past-loan' THEN 'Past-loan'
  WHEN 'pending' THEN 'Pending Request'
  WHEN 'confirmed' THEN 'Upcoming'
  WHEN 'active' THEN 'Ongoing'
  WHEN 'returned' THEN 'Past-loan'
  WHEN 'cancelled' THEN 'Past-loan'
  WHEN 'archived' THEN 'Past-loan'
  ELSE 'Pending Request'
END;

ALTER TABLE reservations
  ALTER COLUMN status TYPE reservation_status_new
  USING status::reservation_status_new;

ALTER TABLE reservations
  ALTER COLUMN status SET DEFAULT 'Pending Request'::reservation_status_new;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status_legacy') THEN
      ALTER TYPE reservation_status RENAME TO reservation_status_legacy;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status_new') THEN
    ALTER TYPE reservation_status_new RENAME TO reservation_status;
  END IF;
END $$;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status::text IN ('Pending Request', 'Upcoming', 'Ongoing', 'Past-loan'));

-- 4) Overlap protection should only block Upcoming/Ongoing
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  v_start_type TEXT;
  v_end_type TEXT;
  v_range_expression TEXT;
  v_has_conflicts BOOLEAN;
BEGIN
  SELECT data_type
  INTO v_start_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'reservations'
    AND column_name = 'start_date';

  SELECT data_type
  INTO v_end_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'reservations'
    AND column_name = 'end_date';

  IF v_start_type = 'date' AND v_end_type = 'date' THEN
    v_range_expression := 'daterange(start_date, end_date, ''[]'')';
  ELSIF v_start_type = 'timestamp with time zone' AND v_end_type = 'timestamp with time zone' THEN
    v_range_expression := 'tstzrange(start_date, end_date, ''[]'')';
  ELSIF v_start_type = 'timestamp without time zone' AND v_end_type = 'timestamp without time zone' THEN
    v_range_expression := 'tsrange(start_date, end_date, ''[]'')';
  ELSE
    RAISE EXCEPTION 'Unsupported reservations date column types: start_date=%, end_date=%', v_start_type, v_end_type;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
       FROM reservations r1
       JOIN reservations r2
         ON r1.item_id = r2.item_id
        AND r1.id < r2.id
      WHERE r1.status IN (''Upcoming''::reservation_status, ''Ongoing''::reservation_status)
        AND r2.status IN (''Upcoming''::reservation_status, ''Ongoing''::reservation_status)
        AND %1$s && %2$s
    )',
    replace(replace(v_range_expression, 'start_date', 'r1.start_date'), 'end_date', 'r1.end_date'),
    replace(replace(v_range_expression, 'start_date', 'r2.start_date'), 'end_date', 'r2.end_date')
  )
  INTO v_has_conflicts;

  IF v_has_conflicts THEN
    RAISE NOTICE 'Skipping no_overlap_upcoming_ongoing because existing reservation data still contains overlapping Upcoming/Ongoing rows.';
  ELSE
    EXECUTE format(
      'ALTER TABLE reservations
         ADD CONSTRAINT no_overlap_upcoming_ongoing
         EXCLUDE USING gist (
           item_id WITH =,
           %s WITH &&
         )
         WHERE (status IN (''Upcoming''::reservation_status, ''Ongoing''::reservation_status))',
      v_range_expression
    );
  END IF;
END $$;

-- 5) Refresh functions that depend on reservation statuses
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
  SELECT i.* FROM items i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
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
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;

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
    RETURN json_build_object('success', false, 'error', 'Dates are no longer available. Another reservation occupies this time slot.');
  END IF;

  UPDATE reservations SET status = 'Upcoming' WHERE id = p_reservation_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_item_availability(UUID, DATE, DATE, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_available_items(DATE, DATE) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_unavailable_date_ranges(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_reservation(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
