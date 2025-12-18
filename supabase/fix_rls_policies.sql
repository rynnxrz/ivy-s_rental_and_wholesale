-- ============================================================
-- FIX RLS: Reset and Restore correct policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure is_admin function is correct
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Reset Policies on ITEMS table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting or wrong policies
DROP POLICY IF EXISTS "Admins can insert items" ON items;
DROP POLICY IF EXISTS "Admins can update items" ON items;
DROP POLICY IF EXISTS "Admins can delete items" ON items;
DROP POLICY IF EXISTS "Anyone can view active items" ON items;
-- Drop common default policies that might have been created by UI starter kits
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON items; 
DROP POLICY IF EXISTS "Enable read access for all users" ON items;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON items;

-- Re-create correct policies
CREATE POLICY "Admins can insert items" ON items
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (is_admin());

CREATE POLICY "Anyone can view active items" ON items
  FOR SELECT USING (status = 'active' OR is_admin());

-- 3. Double Check owner_id is not blocking (Make nullable if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'owner_id') THEN
        ALTER TABLE items ALTER COLUMN owner_id DROP NOT NULL;
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
