-- ============================================================
-- B2B Rental Management System - Complete Setup
-- Supabase (Postgres) with Exclusion Constraints
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- Required for exclusion constraints with UUIDs

-- ============================================================
-- 2. PROFILES TABLE (extends Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. ITEMS TABLE (Product Catalog)
-- ============================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  specs JSONB DEFAULT '{}'::jsonb,
  rental_price DECIMAL(10, 2) NOT NULL,
  replacement_cost DECIMAL(10, 2) NOT NULL,
  image_paths TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_category ON items(category);

-- ============================================================
-- 4. RESERVATIONS TABLE with EXCLUSION CONSTRAINT
-- ============================================================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Basic constraint: end must be after start
  CONSTRAINT valid_date_range CHECK (end_at > start_at)
);

-- ============================================================
-- CRITICAL: EXCLUSION CONSTRAINT (The "Nuclear Option")
-- Prevents overlapping confirmed reservations at the database level
-- Uses btree_gist extension for UUID support
-- 
-- DESIGN DECISION (Intentional):
-- - ONLY 'confirmed' and 'active' status trigger the exclusion
-- - 'pending' reservations CAN overlap (multiple customers can request same slot)
-- - This allows "first-to-be-confirmed" model where Admin picks which pending
--   request to confirm, and the exclusion constraint prevents double-booking
-- ============================================================
ALTER TABLE reservations ADD CONSTRAINT no_overlapping_confirmed_reservations
  EXCLUDE USING gist (
    item_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('confirmed', 'active'));

-- Indexes for performance
CREATE INDEX idx_reservations_item_dates ON reservations(item_id, start_at, end_at);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_time_range ON reservations USING gist (tstzrange(start_at, end_at, '[)'));

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- is_admin(): Stable function for RLS performance
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- is_item_available(): Check if item can be reserved for given time range
-- Used by frontend before attempting reservation
CREATE OR REPLACE FUNCTION is_item_available(
  p_item_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE item_id = p_item_id
      AND status IN ('confirmed', 'active')
      AND tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- get_available_items(): Get all items available for a date range
CREATE OR REPLACE FUNCTION get_available_items(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS SETOF items AS $$
  SELECT i.* FROM items i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.item_id = i.id
        AND r.status IN ('confirmed', 'active')
        AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 6. AUTO-UPDATE TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (is_admin());

-- ITEMS RLS
CREATE POLICY "Anyone can view active items" ON items
  FOR SELECT USING (status = 'active' OR is_admin());

CREATE POLICY "Admins can insert items" ON items
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (is_admin());

-- RESERVATIONS RLS
CREATE POLICY "Users can view own reservations" ON reservations
  FOR SELECT USING (customer_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own reservations" ON reservations
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can update own pending reservations" ON reservations
  FOR UPDATE USING (
    (customer_id = auth.uid() AND status = 'pending') OR is_admin()
  );

CREATE POLICY "Admins can delete reservations" ON reservations
  FOR DELETE USING (is_admin());

-- ============================================================
-- 8. STORAGE BUCKET & POLICIES
-- ============================================================
-- Create the storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('rental_items', 'rental_items', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view all images (bucket is public)
CREATE POLICY "Public read access for item images" ON storage.objects
  FOR SELECT USING (bucket_id = 'rental_items');

-- Only admins can upload images
CREATE POLICY "Admins can upload item images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rental_items' 
    AND (SELECT is_admin())
  );

-- Only admins can update images
CREATE POLICY "Admins can update item images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'rental_items' 
    AND (SELECT is_admin())
  );

-- Only admins can delete images
CREATE POLICY "Admins can delete item images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'rental_items' 
    AND (SELECT is_admin())
  );

