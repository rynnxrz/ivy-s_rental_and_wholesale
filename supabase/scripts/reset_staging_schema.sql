-- RESET AND FIX STAGING IMPORT SCHEMA
-- WARNING: This will clear pending staging data. Safe for development.

-- 1. Clean up existing staging tables to ensure fresh schema
DROP TABLE IF EXISTS staging_items CASCADE;
DROP TABLE IF EXISTS staging_imports CASCADE;

-- 2. Create staging_imports table (batch tracking)
CREATE TABLE staging_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, scanning, completed, failed, imported
  items_scraped INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  current_category TEXT,
  last_scanned_index INTEGER DEFAULT 0,
  product_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create staging_items table (scraped products)
CREATE TABLE staging_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID REFERENCES staging_imports(id) ON DELETE CASCADE,
  
  -- Core item fields
  name TEXT NOT NULL,
  description TEXT,
  rental_price NUMERIC DEFAULT 0,
  replacement_cost NUMERIC DEFAULT 0,
  sku TEXT,
  material TEXT,
  color TEXT,
  weight TEXT,
  image_urls TEXT[],
  
  -- Staging metadata
  source_url TEXT,
  parent_product_id UUID REFERENCES staging_items(id),
  category_id UUID REFERENCES categories(id),
  collection_id UUID REFERENCES collections(id), -- Dual mapping support
  is_variant BOOLEAN DEFAULT false,
  variant_of_name TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ensure 'items' table has necessary columns
DO $$
BEGIN
    -- Add is_ai_generated column if missing
    BEGIN
        ALTER TABLE items ADD COLUMN is_ai_generated BOOLEAN DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;
    
    -- Add import_batch_id column if missing
    BEGIN
        ALTER TABLE items ADD COLUMN import_batch_id UUID REFERENCES staging_imports(id);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;
END $$;

-- 5. RLS Policies
ALTER TABLE staging_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to staging_imports" 
  ON staging_imports FOR ALL USING (is_admin());

CREATE POLICY "Admin full access to staging_items" 
  ON staging_items FOR ALL USING (is_admin());

-- 6. Indexes
CREATE INDEX idx_staging_items_batch ON staging_items(import_batch_id);
CREATE INDEX idx_staging_items_status ON staging_items(status);
CREATE INDEX idx_staging_imports_status ON staging_imports(status);

-- 7. Atomic Commit Function
CREATE OR REPLACE FUNCTION commit_staging_batch(p_batch_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_staging RECORD;
BEGIN
  -- Verify batch has pending items
  IF NOT EXISTS (
    SELECT 1 FROM staging_items 
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  ) THEN
    RETURN QUERY SELECT 0::INTEGER, 'No pending items to import'::TEXT;
    RETURN;
  END IF;

  -- Insert items
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

  -- Update status
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
