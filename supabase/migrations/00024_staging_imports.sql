-- Migration: Add staging_imports table and modify items for AI import traceability
-- Created: 2025-12-23

-- 1. Create staging_imports table for tracking import batches
CREATE TABLE staging_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add traceability fields to items table
ALTER TABLE items 
  ADD COLUMN import_batch_id UUID REFERENCES staging_imports(id),
  ADD COLUMN is_ai_generated BOOLEAN DEFAULT false;

-- 3. RLS policies for staging_imports (admin only)
ALTER TABLE staging_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to staging_imports" 
  ON staging_imports 
  FOR ALL 
  USING (is_admin());

-- 4. Add index for efficient batch lookups
CREATE INDEX idx_items_import_batch_id ON items(import_batch_id);
