-- Unified AI provider settings, runtime decisions, and feedback loop storage.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'ollama',
  ADD COLUMN IF NOT EXISTS ai_primary_model TEXT DEFAULT 'qwen2.5-coder:32b',
  ADD COLUMN IF NOT EXISTS ai_primary_base_url TEXT DEFAULT 'http://127.0.0.1:11434',
  ADD COLUMN IF NOT EXISTS ai_allow_fallback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_fallback_provider TEXT,
  ADD COLUMN IF NOT EXISTS ai_fallback_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_fallback_base_url TEXT,
  ADD COLUMN IF NOT EXISTS document_ai_provider TEXT DEFAULT 'pdfjs',
  ADD COLUMN IF NOT EXISTS document_ai_model TEXT DEFAULT 'glm-ocr',
  ADD COLUMN IF NOT EXISTS document_ai_base_url TEXT DEFAULT 'http://127.0.0.1:5002';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_ai_provider_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_ai_provider_check
      CHECK (ai_provider IN ('ollama', 'gemini', 'dashscope'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_ai_fallback_provider_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_ai_fallback_provider_check
      CHECK (ai_fallback_provider IS NULL OR ai_fallback_provider IN ('ollama', 'gemini', 'dashscope'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_document_ai_provider_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_document_ai_provider_check
      CHECK (document_ai_provider IN ('pdfjs', 'glm-ocr'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  operation TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  entity_type TEXT,
  entity_id TEXT,
  route_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_decisions_status_check'
  ) THEN
    ALTER TABLE ai_decisions
      ADD CONSTRAINT ai_decisions_status_check
      CHECK (status IN ('running', 'completed', 'failed', 'needs_review'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES ai_decisions(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_decision_events_level_check'
  ) THEN
    ALTER TABLE ai_decision_events
      ADD CONSTRAINT ai_decision_events_level_check
      CHECK (level IN ('info', 'success', 'warning', 'error'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES ai_decisions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value JSONB,
  corrected_value JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staging_imports
  ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL;

ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_decisions'
      AND policyname = 'Admin full access to ai_decisions'
  ) THEN
    CREATE POLICY "Admin full access to ai_decisions"
      ON ai_decisions
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_decision_events'
      AND policyname = 'Admin full access to ai_decision_events'
  ) THEN
    CREATE POLICY "Admin full access to ai_decision_events"
      ON ai_decision_events
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_feedback'
      AND policyname = 'Admin full access to ai_feedback'
  ) THEN
    CREATE POLICY "Admin full access to ai_feedback"
      ON ai_feedback
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_decisions_feature_started_at
  ON ai_decisions(feature, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_entity
  ON ai_decisions(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ai_decision_events_decision_id_created_at
  ON ai_decision_events(decision_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_decision_id_created_at
  ON ai_feedback(decision_id, created_at);
