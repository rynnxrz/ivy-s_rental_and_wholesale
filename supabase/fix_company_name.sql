-- Fix missing column company_name in profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company_name') THEN
        ALTER TABLE profiles ADD COLUMN company_name TEXT;
    END IF;
END $$;
