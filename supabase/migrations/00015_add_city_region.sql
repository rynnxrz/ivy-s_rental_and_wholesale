-- Add city_region column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city_region TEXT;

-- Add city_region column to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS city_region TEXT;
