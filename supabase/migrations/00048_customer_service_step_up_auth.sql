-- Customer service step-up authentication: capability cookie + email challenges.

ALTER TABLE customer_service_sessions
  ADD COLUMN IF NOT EXISTS session_secret_hash TEXT,
  ADD COLUMN IF NOT EXISTS verified_email TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS customer_service_email_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES customer_service_sessions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_service_email_challenges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_service_email_challenges'
      AND policyname = 'Admin full access to customer_service_email_challenges'
  ) THEN
    CREATE POLICY "Admin full access to customer_service_email_challenges"
      ON customer_service_email_challenges
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cs_email_challenges_session_email_last_sent
  ON customer_service_email_challenges(session_id, email, last_sent_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_email_challenges_token_hash
  ON customer_service_email_challenges(token_hash);

CREATE INDEX IF NOT EXISTS idx_cs_email_challenges_expires_at
  ON customer_service_email_challenges(expires_at);
