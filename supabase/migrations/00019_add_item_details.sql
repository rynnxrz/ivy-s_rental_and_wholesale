-- Add material and weight columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS weight TEXT;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
