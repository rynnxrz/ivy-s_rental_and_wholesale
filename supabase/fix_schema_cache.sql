-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- Grant permissions to ensure columns are visible
GRANT ALL ON TABLE reservations TO authenticated;
GRANT ALL ON TABLE reservations TO service_role;

-- Optional: Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reservations';
