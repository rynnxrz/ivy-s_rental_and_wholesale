-- ============================================================
-- VERIFICATION: Check if columns exist
-- Run this in Supabase SQL Editor and check the "Results" tab
-- ============================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'items'
ORDER BY 
    column_name;
