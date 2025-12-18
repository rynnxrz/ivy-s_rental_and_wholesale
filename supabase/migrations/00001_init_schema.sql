-- ============================================================
-- B2B Rental Management System - Database Schema
-- Supabase (Postgres) Migration
-- Created: 2025-12-18
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE (extends Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,               -- B2B 客户公司名
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile when user signs up
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
-- 2. ITEMS TABLE (Product Catalog)
-- ============================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,        -- Unique product code
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                   -- e.g., 'ring', 'necklace', 'bracelet'
  
  -- Flexible specs (JSONB)
  specs JSONB DEFAULT '{}'::jsonb, -- e.g., {"size": "6", "material": "18K Gold", "stone": "Diamond"}
  
  -- Pricing
  rental_price DECIMAL(10, 2) NOT NULL,      -- Rental price per day/period
  replacement_cost DECIMAL(10, 2) NOT NULL,  -- Deposit/replacement reference
  
  -- Images (URL array)
  images TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_category ON items(category);

-- ============================================================
-- 3. RESERVATIONS TABLE (Booking/Rental Records)
-- ============================================================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  -- Date range (DATE type, no time component)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status flow: pending -> confirmed -> active -> returned/cancelled
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'cancelled')),
  
  -- Notes
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: end_date >= start_date
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indexes for availability queries
CREATE INDEX idx_reservations_item_dates ON reservations(item_id, start_date, end_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);

-- ============================================================
-- 4. AVAILABILITY CHECK FUNCTION (Core Business Logic)
-- ============================================================
-- Check if an item is available for a given date range
-- Only 'confirmed' and 'active' reservations occupy inventory
CREATE OR REPLACE FUNCTION check_item_availability(
  p_item_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_reservation_id UUID DEFAULT NULL  -- Exclude when editing existing reservation
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE item_id = p_item_id
      AND status IN ('confirmed', 'active')
      AND start_date <= p_end_date    -- Overlap: existing start <= requested end
      AND end_date >= p_start_date    -- Overlap: existing end >= requested start
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 5. AVAILABLE ITEMS VIEW (Convenience View)
-- ============================================================
CREATE OR REPLACE VIEW available_items_today AS
SELECT i.*
FROM items i
WHERE i.status = 'active'
  AND check_item_availability(i.id, CURRENT_DATE, CURRENT_DATE);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ITEMS policies
CREATE POLICY "Anyone can view active items" ON items
  FOR SELECT USING (
    status = 'active' OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert items" ON items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RESERVATIONS policies
CREATE POLICY "Users can view own reservations" ON reservations
  FOR SELECT USING (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can insert own reservations" ON reservations
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can manage all reservations" ON reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 7. AUTO-UPDATE TRIGGERS (updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
