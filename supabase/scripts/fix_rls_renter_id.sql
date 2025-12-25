-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Authenticated users can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;

-- Create INSERT policy using renter_id
CREATE POLICY "Users can insert own reservations"
ON reservations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = renter_id
);

-- Create SELECT policy using renter_id
CREATE POLICY "Users can view own reservations"
ON reservations
FOR SELECT
TO authenticated
USING (
  auth.uid() = renter_id
);

-- Admins can view all
DROP POLICY IF EXISTS "Admins can manage all reservations" ON reservations;
CREATE POLICY "Admins can manage all reservations"
ON reservations
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Force cache reload
NOTIFY pgrst, 'reload schema';
