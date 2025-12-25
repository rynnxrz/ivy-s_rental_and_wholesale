-- Complete migration: Create all staging tables from scratch
-- Run this to set up the AI import system

-- 1. Create staging_imports table (batch tracking)
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

-- 2. Add AI tracking columns to items table FIRST (before function)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'is_ai_generated'
    ) THEN
        ALTER TABLE items ADD COLUMN is_ai_generated BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'import_batch_id'
    ) THEN
        ALTER TABLE items ADD COLUMN import_batch_id UUID;
    END IF;
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

-- 4. RLS policies
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

-- 6. Atomic commit function (NOW items.import_batch_id exists)
CREATE OR REPLACE FUNCTION commit_staging_batch(p_batch_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_staging RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staging_items 
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  ) THEN
    RETURN QUERY SELECT 0::INTEGER, 'No pending items to import'::TEXT;
    RETURN;
  END IF;

  FOR v_staging IN 
    SELECT * FROM staging_items 
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    INSERT INTO items (
      name, description, rental_price, replacement_cost,
      sku, material, color, weight, image_paths,
      category_id, collection_id, status, is_ai_generated, import_batch_id
    ) VALUES (
      v_staging.name,
      v_staging.description,
      COALESCE(v_staging.rental_price, 0),
      COALESCE(v_staging.replacement_cost, 0),
      v_staging.sku,
      v_staging.material,
      v_staging.color,
      v_staging.weight,
      v_staging.image_urls,
      v_staging.category_id,
      v_staging.collection_id,
      'active',
      true,
      p_batch_id
    );
    
    v_count := v_count + 1;
  END LOOP;

  UPDATE staging_items 
  SET status = 'imported' 
  WHERE import_batch_id = p_batch_id AND status = 'pending';

  UPDATE staging_imports 
  SET status = 'imported' 
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION commit_staging_batch(UUID) TO authenticated;
