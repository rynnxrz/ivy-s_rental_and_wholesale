-- ============================================================
-- REPAIR SCHEMA: Ensure ALL items columns exist
-- Run this in Supabase SQL Editor
-- ============================================================

DO $$
BEGIN
    -- 1. Ensure 'sku' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'sku') THEN
        ALTER TABLE items ADD COLUMN sku TEXT;
        CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
        RAISE NOTICE 'Added item.sku';
    END IF;

    -- 2. Ensure 'name' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'name') THEN
        ALTER TABLE items ADD COLUMN name TEXT;
        RAISE NOTICE 'Added item.name';
    END IF;

    -- 3. Ensure 'description' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'description') THEN
        ALTER TABLE items ADD COLUMN description TEXT;
        RAISE NOTICE 'Added item.description';
    END IF;

    -- 4. Ensure 'category' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'category') THEN
        ALTER TABLE items ADD COLUMN category TEXT;
        CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
        RAISE NOTICE 'Added item.category';
    END IF;

    -- 5. Ensure 'specs' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'specs') THEN
        ALTER TABLE items ADD COLUMN specs JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added item.specs';
    END IF;

    -- 6. Ensure 'rental_price' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'rental_price') THEN
        ALTER TABLE items ADD COLUMN rental_price DECIMAL(10, 2) DEFAULT 0.00;
        RAISE NOTICE 'Added item.rental_price';
    END IF;

    -- 7. Ensure 'replacement_cost' exists via standard check
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'replacement_cost') THEN
        ALTER TABLE items ADD COLUMN replacement_cost DECIMAL(10, 2) DEFAULT 0.00;
        RAISE NOTICE 'Added item.replacement_cost';
    END IF;

    -- 8. Ensure 'image_paths' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'image_paths') THEN
        ALTER TABLE items ADD COLUMN image_paths TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added item.image_paths';
    END IF;

    -- 9. Ensure 'status' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'status') THEN
        ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'active';
        CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
        RAISE NOTICE 'Added item.status';
    END IF;

END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
