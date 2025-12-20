-- Add hidden_in_portal column to categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS hidden_in_portal BOOLEAN DEFAULT false;

-- Add hidden_in_portal column to collections
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS hidden_in_portal BOOLEAN DEFAULT false;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
