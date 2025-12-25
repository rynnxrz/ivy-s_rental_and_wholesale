-- 1. Ensure the customer_id column exists
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE RESTRICT;

-- 2. Ensure the status enum has 'pending' and 'active'
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'active';

-- 3. Grant permissions
GRANT ALL ON TABLE reservations TO authenticated;
GRANT ALL ON TABLE reservations TO service_role;
GRANT ALL ON TABLE reservations TO anon; -- Verify if anon needs access (usually not for booking, but for reading?)

-- 4. Reload Schema Cache (CRITICAL)
NOTIFY pgrst, 'reload schema';
