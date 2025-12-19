-- Enable RLS (just in case)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting policies to ensure a clean slate for INSERTS
DROP POLICY IF EXISTS "Users can insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Authenticated users can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;

-- Create the policy
-- This allows any authenticated user to insert a row ONLY IF the customer_id matches their own ID.
CREATE POLICY "Users can insert own reservations"
ON reservations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
);

-- Also ensure they can see their own reservations (so the UI can update/optimistic update if needed)
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;
CREATE POLICY "Users can view own reservations"
ON reservations
FOR SELECT
TO authenticated
USING (
  auth.uid() = customer_id
);

-- Force cache reload
NOTIFY pgrst, 'reload schema';
