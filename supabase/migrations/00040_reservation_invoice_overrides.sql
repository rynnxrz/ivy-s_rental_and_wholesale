-- ============================================================
-- Reservation-level invoice pricing overrides
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS deposit_override DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2);

-- Keep legacy/custom naming aligned where possible.
UPDATE reservations
SET deposit_amount = deposit_override
WHERE deposit_amount IS NULL
  AND deposit_override IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_discount_percent_check'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_discount_percent_check
      CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_deposit_override_check'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_deposit_override_check
      CHECK (deposit_override IS NULL OR deposit_override >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_deposit_amount_check'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_deposit_amount_check
      CHECK (deposit_amount IS NULL OR deposit_amount >= 0);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
