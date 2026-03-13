-- Extend staging import metadata for taxonomy-aware imports and PDF batches.
ALTER TABLE staging_imports
  ALTER COLUMN source_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS source_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS default_line_type TEXT NOT NULL DEFAULT 'Mainline';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_imports_source_type_check'
  ) THEN
    ALTER TABLE staging_imports
      ADD CONSTRAINT staging_imports_source_type_check
      CHECK (source_type IN ('url', 'pdf'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staging_imports_default_line_type_check'
  ) THEN
    ALTER TABLE staging_imports
      ADD CONSTRAINT staging_imports_default_line_type_check
      CHECK (default_line_type IN ('Mainline', 'Collaboration', 'Archive'));
  END IF;
END $$;

UPDATE staging_imports
SET
  source_type = COALESCE(source_type, 'url'),
  default_line_type = CASE
    WHEN source_url ILIKE '%collaboration%' THEN 'Collaboration'
    WHEN source_url ILIKE '%archive%' THEN 'Archive'
    ELSE 'Mainline'
  END,
  source_label = COALESCE(source_label, source_url)
WHERE source_type IS NULL
   OR default_line_type IS NULL
   OR source_label IS NULL;

ALTER TABLE staging_items
  ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'Mainline',
  ADD COLUMN IF NOT EXISTS character_family TEXT NOT NULL DEFAULT 'Uncategorized',
  ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_page INTEGER;

DO $$
BEGIN
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

UPDATE staging_items AS si
SET
  line_type = CASE
    WHEN si.name ILIKE '%collaboration%' THEN 'Collaboration'
    WHEN si.name ILIKE '%archive%' THEN 'Archive'
    WHEN EXISTS (
      SELECT 1
      FROM staging_imports AS sb
      WHERE sb.id = si.import_batch_id
        AND sb.default_line_type IN ('Mainline', 'Collaboration', 'Archive')
    ) THEN (
      SELECT sb.default_line_type
      FROM staging_imports AS sb
      WHERE sb.id = si.import_batch_id
      LIMIT 1
    )
    ELSE 'Mainline'
  END,
  character_family = CASE
    WHEN si.name ~* 'orchid' THEN 'Orchid'
    WHEN si.name ~* 'daffodils?' THEN 'Daffodil'
    WHEN si.name ~* 'sea[[:space:]]*passiflora|\\mpassiflora\\M' THEN 'Sea Passiflora'
    WHEN si.name ~* 'botanic[[:space:]]*elegy' THEN 'Botanic Elegy'
    WHEN si.name ~* 'ocean[[:space:]]*spine|oceanspine' THEN 'Oceanspine'
    ELSE 'Uncategorized'
  END
WHERE line_type IS NULL
   OR character_family IS NULL
   OR btrim(character_family) = '';

CREATE INDEX IF NOT EXISTS idx_staging_items_line_type ON staging_items(line_type);
CREATE INDEX IF NOT EXISTS idx_staging_items_character_family ON staging_items(character_family);
CREATE INDEX IF NOT EXISTS idx_staging_items_source_page ON staging_items(source_page);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'import_documents',
  'import_documents',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

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
  WHERE import_batch_id = p_batch_id AND status = 'pending';

  UPDATE staging_imports
  SET status = 'imported'
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
