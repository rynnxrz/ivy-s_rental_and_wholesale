-- Add prompt history tracking for AI prompts
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS prompt_history JSONB DEFAULT '{}'::jsonb;
