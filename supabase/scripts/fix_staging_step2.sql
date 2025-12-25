-- STEP 2: Run this AFTER step 1 succeeds
-- Creates the atomic commit function

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
