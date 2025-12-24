-- Migration: Add ai_max_output_tokens column
-- Allows configuring max output tokens for AI responses

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ai_max_output_tokens INTEGER DEFAULT NULL;

COMMENT ON COLUMN app_settings.ai_max_output_tokens IS 'Maximum output tokens for AI responses. NULL uses model default.';
