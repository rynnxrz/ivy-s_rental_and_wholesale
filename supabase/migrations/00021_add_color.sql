-- Add color column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS color TEXT;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
