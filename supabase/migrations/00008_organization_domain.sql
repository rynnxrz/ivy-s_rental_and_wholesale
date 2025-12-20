-- Add organization_domain column to profiles for B2B tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_domain TEXT;
