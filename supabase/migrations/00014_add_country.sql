-- Add country column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- Add country column to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS country TEXT;
