-- Add priority column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
