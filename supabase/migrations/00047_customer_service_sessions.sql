-- Customer-facing AI service sessions and message history.

CREATE TABLE IF NOT EXISTS customer_service_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'planning',
  pending_plan JSONB,
  page_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  identity_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_service_sessions_status_check'
  ) THEN
    ALTER TABLE customer_service_sessions
      ADD CONSTRAINT customer_service_sessions_status_check
      CHECK (status IN ('planning', 'awaiting_confirmation', 'executing', 'completed', 'failed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS customer_service_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES customer_service_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'message',
  text_content TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_service_messages_role_check'
  ) THEN
    ALTER TABLE customer_service_messages
      ADD CONSTRAINT customer_service_messages_role_check
      CHECK (role IN ('user', 'assistant', 'tool'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_service_messages_kind_check'
  ) THEN
    ALTER TABLE customer_service_messages
      ADD CONSTRAINT customer_service_messages_kind_check
      CHECK (kind IN ('message', 'plan', 'tool_result', 'feedback', 'system'));
  END IF;
END $$;

ALTER TABLE customer_service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_service_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_service_sessions'
      AND policyname = 'Admin full access to customer_service_sessions'
  ) THEN
    CREATE POLICY "Admin full access to customer_service_sessions"
      ON customer_service_sessions
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
      AND tablename = 'customer_service_messages'
      AND policyname = 'Admin full access to customer_service_messages'
  ) THEN
    CREATE POLICY "Admin full access to customer_service_messages"
      ON customer_service_messages
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_customer_service_sessions_updated_at ON customer_service_sessions;
CREATE TRIGGER update_customer_service_sessions_updated_at
  BEFORE UPDATE ON customer_service_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_customer_service_sessions_last_active_at
  ON customer_service_sessions(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_service_sessions_decision_id
  ON customer_service_sessions(decision_id);

CREATE INDEX IF NOT EXISTS idx_customer_service_messages_session_id_created_at
  ON customer_service_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_service_messages_decision_id
  ON customer_service_messages(decision_id);
