-- STEP 1: Run this first
-- Creates tables and adds columns to items

-- 1. Create staging_imports table
CREATE TABLE IF NOT EXISTS staging_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  items_scraped INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  current_category TEXT,
  last_scanned_index INTEGER DEFAULT 0,
  product_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns to items table (use DO block for compatibility)
DO $$
BEGIN
    -- Add is_ai_generated column
    BEGIN
        ALTER TABLE items ADD COLUMN is_ai_generated BOOLEAN DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN
        NULL; -- Column already exists
    END;
    
    -- Add import_batch_id column
    BEGIN
        ALTER TABLE items ADD COLUMN import_batch_id UUID;
    EXCEPTION WHEN duplicate_column THEN
        NULL; -- Column already exists
    END;
END $$;

-- 3. Create staging_items table
CREATE TABLE IF NOT EXISTS staging_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID REFERENCES staging_imports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rental_price NUMERIC DEFAULT 0,
  replacement_cost NUMERIC DEFAULT 0,
  sku TEXT,
  material TEXT,
  color TEXT,
  weight TEXT,
  image_urls TEXT[],
  source_url TEXT,
  parent_product_id UUID,
  category_id UUID,
  collection_id UUID,
  is_variant BOOLEAN DEFAULT false,
  variant_of_name TEXT,
  status TEXT DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE staging_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to staging_imports" ON staging_imports;
DROP POLICY IF EXISTS "Admin full access to staging_items" ON staging_items;

CREATE POLICY "Admin full access to staging_imports" 
  ON staging_imports FOR ALL USING (is_admin());

CREATE POLICY "Admin full access to staging_items" 
  ON staging_items FOR ALL USING (is_admin());

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_staging_items_batch ON staging_items(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_items_status ON staging_items(status);
CREATE INDEX IF NOT EXISTS idx_staging_imports_status ON staging_imports(status);
