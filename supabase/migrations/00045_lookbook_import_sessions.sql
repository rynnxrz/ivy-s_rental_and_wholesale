ALTER TABLE staging_imports
  ADD COLUMN IF NOT EXISTS structure_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS overall_status TEXT NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_file_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_imports_overall_status_check'
  ) THEN
    ALTER TABLE staging_imports
      ADD CONSTRAINT staging_imports_overall_status_check
      CHECK (overall_status IN (
        'uploaded',
        'parse_failed',
        'awaiting_structure_confirmation',
        'processing_drafts',
        'awaiting_item_confirmation',
        'confirmed_ready_to_import',
        'imported'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staging_import_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES staging_imports(id) ON DELETE CASCADE,
  item_id UUID REFERENCES staging_items(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value JSONB,
  corrected_value JSONB,
  reason TEXT,
  corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staging_import_corrections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staging_import_corrections'
      AND policyname = 'Admin full access to staging_import_corrections'
  ) THEN
    CREATE POLICY "Admin full access to staging_import_corrections"
      ON staging_import_corrections
      FOR ALL
      USING (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_import_corrections_scope_check'
  ) THEN
    ALTER TABLE staging_import_corrections
      ADD CONSTRAINT staging_import_corrections_scope_check
      CHECK (scope IN ('structure', 'item', 'session'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staging_imports_overall_status
  ON staging_imports(overall_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staging_import_corrections_session
  ON staging_import_corrections(session_id, corrected_at DESC);

CREATE INDEX IF NOT EXISTS idx_staging_import_corrections_item
  ON staging_import_corrections(item_id, corrected_at DESC);

ALTER TABLE staging_import_events
  DROP CONSTRAINT IF EXISTS staging_import_events_step_check;

ALTER TABLE staging_import_events
  ADD CONSTRAINT staging_import_events_step_check
  CHECK (step IN (
    'upload',
    'parse',
    'structure_map',
    'plan',
    'series_extract',
    'item_extract',
    'review',
    'confirm',
    'import',
    'error'
  ));

ALTER TABLE staging_import_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staging_import_events'
      AND policyname = 'Admin full access to staging_import_events'
  ) THEN
    CREATE POLICY "Admin full access to staging_import_events"
      ON staging_import_events
      FOR ALL
      USING (is_admin());
  END IF;
END $$;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'application/json']
WHERE id = 'import_documents';

CREATE OR REPLACE FUNCTION commit_lookbook_import_session(p_session_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_existing_count INTEGER := 0;
  v_staging RECORD;
BEGIN
  SELECT COUNT(*) INTO v_existing_count
  FROM items
  WHERE import_batch_id = p_session_id;

  IF NOT EXISTS (
    SELECT 1
    FROM staging_items
    WHERE import_batch_id = p_session_id
      AND status = 'confirmed'
      AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE)
  ) THEN
    IF v_existing_count > 0 THEN
      RETURN QUERY SELECT v_existing_count, NULL::TEXT;
    ELSE
      RETURN QUERY SELECT 0::INTEGER, 'No confirmed items to import'::TEXT;
    END IF;
    RETURN;
  END IF;

  FOR v_staging IN
    SELECT *
    FROM staging_items
    WHERE import_batch_id = p_session_id
      AND status = 'confirmed'
      AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM items
      WHERE import_batch_id = p_session_id
        AND COALESCE(sku, '') = COALESCE(v_staging.sku, '')
        AND name = v_staging.name
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO items (
      name,
      description,
      rental_price,
      replacement_cost,
      sku,
      material,
      color,
      weight,
      image_paths,
      category_id,
      collection_id,
      specs,
      line_type,
      character_family,
      status,
      is_ai_generated,
      import_batch_id
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
      COALESCE(v_staging.specs, '{}'::jsonb),
      COALESCE(v_staging.line_type, 'Mainline'),
      COALESCE(NULLIF(BTRIM(v_staging.character_family), ''), 'Uncategorized'),
      'active',
      TRUE,
      p_session_id
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE staging_items
  SET status = 'imported'
  WHERE import_batch_id = p_session_id
    AND status = 'confirmed'
    AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE);

  UPDATE staging_imports
  SET
    status = 'imported',
    overall_status = 'imported',
    confirmed_at = COALESCE(confirmed_at, NOW())
  WHERE id = p_session_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.commit_lookbook_import_session(UUID) SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION commit_lookbook_import_session(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
