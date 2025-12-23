-- Migration: Add batch processing support and atomic commit RPC
-- Created: 2025-12-23

-- 1. Add batch processing columns to staging_imports
ALTER TABLE staging_imports 
  ADD COLUMN IF NOT EXISTS last_scanned_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_urls TEXT[];

-- 2. Create atomic commit function using transaction
CREATE OR REPLACE FUNCTION commit_staging_batch(p_batch_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_staging RECORD;
BEGIN
  -- Validate batch exists and has pending items
  IF NOT EXISTS (
    SELECT 1 FROM staging_items 
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  ) THEN
    RETURN QUERY SELECT 0::INTEGER, 'No pending items to import'::TEXT;
    RETURN;
  END IF;

  -- Insert all staging items into items table atomically
  FOR v_staging IN 
    SELECT * FROM staging_items 
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    INSERT INTO items (
      name, description, rental_price, replacement_cost,
      sku, material, color, weight, image_paths,
      category_id, status, is_ai_generated, import_batch_id
    ) VALUES (
      v_staging.name,
      v_staging.description,
      COALESCE(v_staging.rental_price, 0),
      COALESCE(v_staging.replacement_cost, 0),
      v_staging.sku,
      v_staging.material,
      v_staging.color,
      v_staging.weight,
      v_staging.image_urls, -- Will be migrated paths after image processing
      v_staging.category_id,
      'active',
      true,
      p_batch_id
    );
    
    v_count := v_count + 1;
  END LOOP;

  -- Mark all staging items as imported
  UPDATE staging_items 
  SET status = 'imported' 
  WHERE import_batch_id = p_batch_id AND status = 'pending';

  -- Update batch status
  UPDATE staging_imports 
  SET status = 'imported' 
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback happens automatically, return error
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION commit_staging_batch(UUID) TO authenticated;
