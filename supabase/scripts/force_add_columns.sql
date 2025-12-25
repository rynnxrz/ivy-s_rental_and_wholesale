-- ============================================================
-- FORCE REPAIR: Add missing columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add SKU (Missing)
ALTER TABLE items ADD COLUMN IF NOT EXISTS sku TEXT;
-- Make it unique if possible, but standard text first to allow insert
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_items_sku ON items(sku); 

-- 2. Add Specs (Missing)
ALTER TABLE items ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;

-- 3. Relax owner_id (Unexpected column present in your DB)
-- If this is NOT NULL and has no default, it will block inserts.
-- checking if it exists first requires a DO block, but let's try to alter it if it exists.
-- A safe way without DO block is hard standard SQL, but IF EXISTS is Postgres specific.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'owner_id') THEN
        ALTER TABLE items ALTER COLUMN owner_id DROP NOT NULL;
    END IF;
END $$;

-- 4. Force Reload
NOTIFY pgrst, 'reload config';
