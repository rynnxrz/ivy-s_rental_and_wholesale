-- Consolidated migration for fingerprint and admin_notes
-- Adds columns if they don't exist and enforces uniqueness on fingerprint

DO $$
BEGIN
    -- 1. Add columns if not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'fingerprint') THEN
        ALTER TABLE reservations ADD COLUMN fingerprint text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'admin_notes') THEN
        ALTER TABLE reservations ADD COLUMN admin_notes text;
    END IF;

    -- 2. Add Unique Constraint (automatically creates an index)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_reservation_fingerprint'
    ) THEN
        ALTER TABLE reservations
        ADD CONSTRAINT unique_reservation_fingerprint UNIQUE (fingerprint);
    END IF;
END $$;
