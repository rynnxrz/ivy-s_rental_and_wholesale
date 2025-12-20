-- Create billing_profiles table for multi-profile billing
CREATE TABLE IF NOT EXISTS billing_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name TEXT NOT NULL,
    company_header TEXT NOT NULL,          -- Company name, address info
    bank_info TEXT NOT NULL,               -- Bank account details  
    contact_email TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one default profile at a time
-- This is a partial unique index: only one row can have is_default = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS one_default_profile 
ON billing_profiles (is_default) WHERE is_default = TRUE;

-- RLS policies
ALTER TABLE billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage billing profiles" ON billing_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Everyone can read billing profiles" ON billing_profiles
    FOR SELECT USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_billing_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_profiles_updated_at
    BEFORE UPDATE ON billing_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_profiles_updated_at();

-- Migrate existing app_settings data to first billing profile (if exists)
INSERT INTO billing_profiles (profile_name, company_header, bank_info, contact_email, is_default)
SELECT 
    'Default Profile',
    COALESCE(company_name, 'My Company'),
    COALESCE(bank_account_info, 'Bank details not set'),
    contact_email,
    TRUE
FROM app_settings
WHERE id = TRUE
ON CONFLICT DO NOTHING;
