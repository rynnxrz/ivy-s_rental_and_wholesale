-- Add booking_password column to app_settings for access control
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS booking_password TEXT;
