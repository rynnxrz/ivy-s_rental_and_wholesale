-- ============================================================
-- FIX ADMIN ROLE SCRIPT
-- Run this in Supabase SQL Editor to make yourself an admin.
-- ============================================================

-- STEP 1: Check if your profile exists
SELECT * FROM profiles WHERE email = 'rynnxrz@gmail.com';

-- STEP 2: Check auth.users to see if user exists there
SELECT id, email FROM auth.users WHERE email = 'rynnxrz@gmail.com';

-- STEP 3: If profile doesn't exist but auth.users does, create the profile:
-- (Only run this if STEP 1 returned no rows but STEP 2 returned a row)
INSERT INTO profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'rynnxrz@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- STEP 4: Verify the fix worked
SELECT id, email, role FROM profiles WHERE email = 'rynnxrz@gmail.com';
