-- Migration: Add ai_use_system_instruction column
-- Toggle for enabling base system instruction across all AI functions

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ai_use_system_instruction BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN app_settings.ai_use_system_instruction IS 'Enable to apply base persona and guidelines to all AI functions.';
