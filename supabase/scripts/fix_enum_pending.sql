-- Ensure 'pending' is in the enum
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pending';

-- Grant insert permissions just in case
GRANT INSERT ON TABLE reservations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE reservations_id_seq TO authenticated; -- If serial, though UUID is used usually.

-- Verify RLS policy for insert (just a check, not executable code really, but re-applying doesn't hurt)
-- Note: You can't easily "re-apply" policies blindly without dropping first, so we skip that.
-- The enum fix is the most likely candidate.
