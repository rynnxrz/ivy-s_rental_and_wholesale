-- Add address columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Add address columns to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT;
