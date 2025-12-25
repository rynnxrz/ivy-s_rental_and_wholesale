-- Run this in your Supabase SQL Editor if 'company_name' is missing from 'profiles'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
