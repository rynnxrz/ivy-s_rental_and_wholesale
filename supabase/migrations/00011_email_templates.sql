-- Add email template fields to app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_approval_body TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_footer TEXT;
