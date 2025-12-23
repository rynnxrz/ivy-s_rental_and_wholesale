-- Migration: Add staging_items table for temporary scraped products
-- Created: 2025-12-23

-- 1. Create staging_items table for scraped products before approval
CREATE TABLE staging_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID REFERENCES staging_imports(id) ON DELETE CASCADE,
  
  -- Core item fields (matching items table structure)
  name TEXT NOT NULL,
  description TEXT,
  rental_price NUMERIC DEFAULT 0,
  replacement_cost NUMERIC DEFAULT 0,
  sku TEXT,
  material TEXT,
  color TEXT,
  weight TEXT,
  image_urls TEXT[],
  
  -- Staging metadata
  source_url TEXT,
  parent_product_id UUID REFERENCES staging_items(id), -- For variants linking
  category_id UUID REFERENCES categories(id),
  collection_id UUID REFERENCES collections(id),  -- NEW: For dual mapping
  is_variant BOOLEAN DEFAULT false,
  variant_of_name TEXT, -- Parent product name for reference
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, imported
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS policies (admin only)
ALTER TABLE staging_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to staging_items" 
  ON staging_items 
  FOR ALL 
  USING (is_admin());

-- 3. Indexes for efficient queries
CREATE INDEX idx_staging_items_batch ON staging_items(import_batch_id);
CREATE INDEX idx_staging_items_parent ON staging_items(parent_product_id);
CREATE INDEX idx_staging_items_status ON staging_items(status);

-- 4. Add items_scraped count to staging_imports
ALTER TABLE staging_imports 
  ADD COLUMN items_scraped INTEGER DEFAULT 0,
  ADD COLUMN items_total INTEGER DEFAULT 0,
  ADD COLUMN current_category TEXT;
