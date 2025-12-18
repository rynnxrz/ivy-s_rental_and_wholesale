-- ============================================================
-- DEBUG RLS: Inspect Policies and Admin Status
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. List all policies on the 'items' table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'items';

-- 2. Check if your user is recognized as an admin
-- Replace 'rynnxrz@gmail.com' if you are testing with a different user
SELECT 
    id, 
    email, 
    role 
FROM 
    profiles 
WHERE 
    email = 'rynnxrz@gmail.com';

-- 3. Check the definition of the is_admin function
SELECT 
    proname, 
    prosrc 
FROM 
    pg_proc 
WHERE 
    proname = 'is_admin';
