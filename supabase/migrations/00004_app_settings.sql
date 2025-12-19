-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CONSTRAINT single_row CHECK (id = TRUE),
    company_name TEXT DEFAULT 'Ivy''s Rental',
    bank_account_info TEXT DEFAULT 'Bank: Chase\nAccount: 1234567890\nRouting: 987654321',
    invoice_footer_text TEXT DEFAULT 'Thank you for your business!',
    contact_email TEXT DEFAULT 'contact@ivysrental.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON app_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Everyone can read settings" ON app_settings
    FOR SELECT USING (true);

-- Insert default row if not exists
INSERT INTO app_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
