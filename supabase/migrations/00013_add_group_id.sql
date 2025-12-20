-- Add group_id column to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS group_id UUID;

-- Optional: Index on group_id for faster lookups
CREATE INDEX IF NOT EXISTS reservations_group_id_idx ON reservations(group_id);
