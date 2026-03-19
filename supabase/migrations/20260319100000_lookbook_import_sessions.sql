-- Migration: Lookbook Import Sessions & Agent Pipeline State
-- Architecture: Smart Agent, Dumb Tools — DecisionID-driven pipeline
-- Created: 2026-03-19

-- ============================================================
-- 1. Import Sessions (DecisionID = session_id)
--    Each PDF upload creates one session. All downstream state
--    is tracked under this single ID for full-chain traceability.
-- ============================================================
CREATE TABLE IF NOT EXISTS lookbook_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_file_name TEXT NOT NULL,
  source_storage_path TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,

  -- Pipeline state
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN (
      'uploading',        -- PDF received, converting to images
      'analyzing',        -- SeriesExtractorAgent running
      'extracting',       -- ProductDataAgent running
      'validating',       -- ValidationAgent running
      'awaiting_review',  -- Plan Gate: user must confirm
      'importing',        -- db_write_tool committing
      'completed',        -- All done
      'failed'            -- Unrecoverable error
    )),

  -- Agent results (JSONB for flexibility during iteration)
  series_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. [{"name":"Rebirth","pages":[3,4,5,6],"item_count":8}]

  extraction_result JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. [{"sku":"RB-DAF-WH001-S","series":"Rebirth","fields":{...},"issues":[]}]

  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"total":19,"valid":17,"warnings":2,"errors":0,"issues":[...]}

  -- Config
  default_line_type TEXT NOT NULL DEFAULT 'Mainline',
  ai_model_id TEXT NOT NULL DEFAULT 'qwen-vl-max',
  ai_provider TEXT NOT NULL DEFAULT 'qwen',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Pipeline Event Log (per-session audit trail)
--    Every Agent step and Tool invocation is logged here.
-- ============================================================
CREATE TABLE IF NOT EXISTS lookbook_import_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lookbook_import_sessions(id) ON DELETE CASCADE,

  step TEXT NOT NULL
    CHECK (step IN (
      'upload',
      'pdf_to_images',
      'series_extraction',
      'product_extraction',
      'validation',
      'user_review',
      'image_crop',
      'db_write',
      'commit'
    )),

  level TEXT NOT NULL DEFAULT 'info'
    CHECK (level IN ('info', 'success', 'warning', 'error')),

  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  elapsed_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Extracted Items (staging area per session)
--    Items live here until the user confirms via Plan Gate.
-- ============================================================
CREATE TABLE IF NOT EXISTS lookbook_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lookbook_import_sessions(id) ON DELETE CASCADE,

  -- Series grouping
  series_name TEXT NOT NULL DEFAULT 'Uncategorized',

  -- Core product fields
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  material TEXT,
  color TEXT,
  weight TEXT,
  size TEXT,
  accessories TEXT,
  rrp NUMERIC,

  -- Media
  source_page INTEGER,
  image_region JSONB,
  -- e.g. {"x":120,"y":80,"width":300,"height":400} — coordinates on the rendered page image
  cropped_image_url TEXT,

  -- Classification
  category_form TEXT,
  character_family TEXT NOT NULL DEFAULT 'Uncategorized',
  line_type TEXT NOT NULL DEFAULT 'Mainline',

  -- Review state
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'skipped', 'imported')),
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. [{"type":"missing_price","message":"RRP not detected"}]
  user_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"rrp":120,"color":"Gold"} — user corrections from Plan Gate

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. RLS Policies (admin only)
-- ============================================================
ALTER TABLE lookbook_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookbook_import_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookbook_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to lookbook_import_sessions"
  ON lookbook_import_sessions FOR ALL USING (is_admin());

CREATE POLICY "Admin full access to lookbook_import_events"
  ON lookbook_import_events FOR ALL USING (is_admin());

CREATE POLICY "Admin full access to lookbook_import_items"
  ON lookbook_import_items FOR ALL USING (is_admin());

-- ============================================================
-- 5. Indexes
-- ============================================================
CREATE INDEX idx_lookbook_events_session ON lookbook_import_events(session_id, created_at);
CREATE INDEX idx_lookbook_items_session ON lookbook_import_items(session_id);
CREATE INDEX idx_lookbook_items_series ON lookbook_import_items(series_name);
CREATE INDEX idx_lookbook_items_status ON lookbook_import_items(status);
CREATE INDEX idx_lookbook_sessions_status ON lookbook_import_sessions(status);

-- ============================================================
-- 6. Commit function: move confirmed items to production
-- ============================================================
CREATE OR REPLACE FUNCTION commit_lookbook_import(p_session_id UUID)
RETURNS TABLE(imported_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_item RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lookbook_import_items
    WHERE session_id = p_session_id AND status = 'confirmed'
  ) THEN
    RETURN QUERY SELECT 0::INTEGER, 'No confirmed items to import'::TEXT;
    RETURN;
  END IF;

  FOR v_item IN
    SELECT * FROM lookbook_import_items
    WHERE session_id = p_session_id AND status = 'confirmed'
  LOOP
    INSERT INTO items (
      name, description, rental_price, replacement_cost,
      sku, material, color, weight, image_paths,
      category_id, collection_id, specs,
      line_type, character_family,
      status, is_ai_generated, import_batch_id
    ) VALUES (
      COALESCE(v_item.user_overrides->>'name', v_item.name),
      COALESCE(v_item.user_overrides->>'description', v_item.description),
      0,
      COALESCE(
        (v_item.user_overrides->>'rrp')::NUMERIC,
        v_item.rrp,
        0
      ),
      COALESCE(v_item.user_overrides->>'sku', v_item.sku),
      COALESCE(v_item.user_overrides->>'material', v_item.material),
      COALESCE(v_item.user_overrides->>'color', v_item.color),
      COALESCE(v_item.user_overrides->>'weight', v_item.weight),
      CASE WHEN v_item.cropped_image_url IS NOT NULL
        THEN ARRAY[v_item.cropped_image_url]
        ELSE ARRAY[]::TEXT[]
      END,
      NULL, -- category_id resolved later
      NULL, -- collection_id resolved later
      jsonb_build_object(
        'size', COALESCE(v_item.user_overrides->>'size', v_item.size),
        'accessories', COALESCE(v_item.user_overrides->>'accessories', v_item.accessories)
      ),
      COALESCE(v_item.line_type, 'Mainline'),
      COALESCE(NULLIF(btrim(v_item.character_family), ''), 'Uncategorized'),
      'active',
      true,
      p_session_id
    );
    v_count := v_count + 1;
  END LOOP;

  -- Mark items as imported
  UPDATE lookbook_import_items
  SET status = 'imported'
  WHERE session_id = p_session_id AND status = 'confirmed';

  -- Mark session as completed
  UPDATE lookbook_import_sessions
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_session_id;

  RETURN QUERY SELECT v_count, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
