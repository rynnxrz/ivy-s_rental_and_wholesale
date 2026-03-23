-- Guided import metadata, event logging, and official Character backfill.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'Mainline',
  ADD COLUMN IF NOT EXISTS character_family TEXT NOT NULL DEFAULT 'Uncategorized';

ALTER TABLE staging_items
  ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'Mainline',
  ADD COLUMN IF NOT EXISTS character_family TEXT NOT NULL DEFAULT 'Uncategorized',
  ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS import_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_line_type_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_line_type_check
      CHECK (line_type IN ('Mainline', 'Collaboration', 'Archive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_character_family_not_blank_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_character_family_not_blank_check
      CHECK (btrim(character_family) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_items_line_type_check'
  ) THEN
    ALTER TABLE staging_items
      ADD CONSTRAINT staging_items_line_type_check
      CHECK (line_type IN ('Mainline', 'Collaboration', 'Archive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_items_character_family_not_blank_check'
  ) THEN
    ALTER TABLE staging_items
      ADD CONSTRAINT staging_items_character_family_not_blank_check
      CHECK (btrim(character_family) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_items_source_page_check'
  ) THEN
    ALTER TABLE staging_items
      ADD CONSTRAINT staging_items_source_page_check
      CHECK (source_page IS NULL OR source_page > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staging_import_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL REFERENCES staging_imports(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_ref UUID REFERENCES staging_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_import_events_step_check'
  ) THEN
    ALTER TABLE staging_import_events
      ADD CONSTRAINT staging_import_events_step_check
      CHECK (step IN (
        'file_read',
        'pdf_parse',
        'draft_build',
        'questions',
        'website_match',
        'image_match',
        'review_ready',
        'inventory_import'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_import_events_level_check'
  ) THEN
    ALTER TABLE staging_import_events
      ADD CONSTRAINT staging_import_events_level_check
      CHECK (level IN ('info', 'success', 'warning', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staging_import_events_batch_id ON staging_import_events(import_batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_staging_import_events_item_ref ON staging_import_events(item_ref);
CREATE INDEX IF NOT EXISTS idx_items_line_type ON items(line_type);
CREATE INDEX IF NOT EXISTS idx_items_character_family ON items(character_family);
CREATE INDEX IF NOT EXISTS idx_staging_items_line_type ON staging_items(line_type);
CREATE INDEX IF NOT EXISTS idx_staging_items_character_family ON staging_items(character_family);
CREATE INDEX IF NOT EXISTS idx_staging_items_source_page ON staging_items(source_page);

UPDATE items
SET line_type = 'Mainline'
WHERE line_type IS NULL
   OR line_type NOT IN ('Mainline', 'Collaboration', 'Archive');

UPDATE items
SET character_family = 'Uncategorized'
WHERE character_family IS NULL
   OR btrim(character_family) = '';

UPDATE staging_items
SET line_type = 'Mainline'
WHERE line_type IS NULL
   OR line_type NOT IN ('Mainline', 'Collaboration', 'Archive');

UPDATE staging_items
SET character_family = 'Uncategorized'
WHERE character_family IS NULL
   OR btrim(character_family) = '';

UPDATE items
SET character_family = CASE
  WHEN character_family = 'Orchid' THEN 'Orchid Whisper'
  WHEN character_family = 'Daffodil' THEN 'Daffodil Blossom'
  WHEN character_family = 'Oceanspine' THEN 'Oceanspine Petals'
  ELSE character_family
END
WHERE character_family IN ('Orchid', 'Daffodil', 'Oceanspine');

UPDATE staging_items
SET character_family = CASE
  WHEN character_family = 'Orchid' THEN 'Orchid Whisper'
  WHEN character_family = 'Daffodil' THEN 'Daffodil Blossom'
  WHEN character_family = 'Oceanspine' THEN 'Oceanspine Petals'
  ELSE character_family
END
WHERE character_family IN ('Orchid', 'Daffodil', 'Oceanspine');

UPDATE staging_items
SET import_metadata = jsonb_set(
  COALESCE(import_metadata, '{}'::jsonb),
  '{selected_by_user}',
  'true'::jsonb,
  true
)
WHERE COALESCE(import_metadata->>'selected_by_user', '') = '';

CREATE OR REPLACE FUNCTION commit_staging_batch(p_batch_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_staging RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staging_items
    WHERE import_batch_id = p_batch_id
      AND status = 'pending'
      AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE)
  ) THEN
    RETURN QUERY SELECT 0::INTEGER, 'No pending items to import'::TEXT;
    RETURN;
  END IF;

  FOR v_staging IN
    SELECT * FROM staging_items
    WHERE import_batch_id = p_batch_id
      AND status = 'pending'
      AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE)
  LOOP
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
      COALESCE(NULLIF(btrim(v_staging.character_family), ''), 'Uncategorized'),
      'active',
      true,
      p_batch_id
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE staging_items
  SET status = 'imported'
  WHERE import_batch_id = p_batch_id
    AND status = 'pending'
    AND COALESCE((import_metadata->>'selected_by_user')::BOOLEAN, TRUE);

  UPDATE staging_imports
  SET status = 'imported'
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
