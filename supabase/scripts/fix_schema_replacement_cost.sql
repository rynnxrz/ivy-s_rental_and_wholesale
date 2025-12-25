-- ============================================================
-- FIX SCHEMA: Add replacement_cost column
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'items'
        AND column_name = 'replacement_cost'
    ) THEN
        -- Adding with default 0 to handle existing rows, then dropping default if strictness is needed (optional)
        ALTER TABLE items ADD COLUMN replacement_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
        RAISE NOTICE 'Added replacement_cost column';
    ELSE
        RAISE NOTICE 'replacement_cost column already exists';
    END IF;
END $$;

-- 2. Force PostgREST schema cache reload
-- This is critical to make the API aware of the new column
NOTIFY pgrst, 'reload config';
