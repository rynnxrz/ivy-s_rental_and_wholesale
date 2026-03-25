-- Ask Ivy v1: concierge handoffs and reservation-group assessments.

CREATE TABLE IF NOT EXISTS customer_service_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES customer_service_sessions(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
  intent TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_label TEXT NOT NULL DEFAULT 'Ivy concierge',
  sla_label TEXT NOT NULL DEFAULT 'within 2 business hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_service_handoffs_status_check'
  ) THEN
    ALTER TABLE customer_service_handoffs
      ADD CONSTRAINT customer_service_handoffs_status_check
      CHECK (status IN ('open', 'closed'));
  END IF;
END $$;

ALTER TABLE customer_service_handoffs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_service_handoffs'
      AND policyname = 'Admin full access to customer_service_handoffs'
  ) THEN
    CREATE POLICY "Admin full access to customer_service_handoffs"
      ON customer_service_handoffs
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_customer_service_handoffs_updated_at ON customer_service_handoffs;
CREATE TRIGGER update_customer_service_handoffs_updated_at
  BEFORE UPDATE ON customer_service_handoffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_customer_service_handoffs_session_id
  ON customer_service_handoffs(session_id);

CREATE INDEX IF NOT EXISTS idx_customer_service_handoffs_status_created_at
  ON customer_service_handoffs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS reservation_group_assessments (
  group_key TEXT PRIMARY KEY,
  primary_reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  renter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status_snapshot TEXT NOT NULL DEFAULT 'Pending Request',
  priority_score INTEGER NOT NULL DEFAULT 0,
  priority_band TEXT NOT NULL DEFAULT 'standard',
  value_tier TEXT NOT NULL DEFAULT 'standard',
  feasibility_status TEXT NOT NULL DEFAULT 'watch',
  risk_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  recommended_next_step TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_group_assessments_priority_band_check'
  ) THEN
    ALTER TABLE reservation_group_assessments
      ADD CONSTRAINT reservation_group_assessments_priority_band_check
      CHECK (priority_band IN ('urgent', 'high', 'standard', 'low'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_group_assessments_value_tier_check'
  ) THEN
    ALTER TABLE reservation_group_assessments
      ADD CONSTRAINT reservation_group_assessments_value_tier_check
      CHECK (value_tier IN ('vip', 'high', 'standard', 'low'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_group_assessments_feasibility_status_check'
  ) THEN
    ALTER TABLE reservation_group_assessments
      ADD CONSTRAINT reservation_group_assessments_feasibility_status_check
      CHECK (feasibility_status IN ('clear', 'watch', 'high_risk'));
  END IF;
END $$;

ALTER TABLE reservation_group_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reservation_group_assessments'
      AND policyname = 'Admin full access to reservation_group_assessments'
  ) THEN
    CREATE POLICY "Admin full access to reservation_group_assessments"
      ON reservation_group_assessments
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_reservation_group_assessments_updated_at ON reservation_group_assessments;
CREATE TRIGGER update_reservation_group_assessments_updated_at
  BEFORE UPDATE ON reservation_group_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_reservation_group_assessments_status_priority
  ON reservation_group_assessments(status_snapshot, priority_score DESC, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_group_assessments_renter_id
  ON reservation_group_assessments(renter_id);
