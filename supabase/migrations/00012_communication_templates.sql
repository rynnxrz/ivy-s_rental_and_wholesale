-- Add communication template fields to app_settings

-- Shipping email templates
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_shipping_subject TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_shipping_body TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_shipping_footer TEXT;

-- Invoice PDF defaults
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS invoice_company_header TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS invoice_footer_text TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS invoice_notes_default TEXT;
