-- Quick Scan Fields Migration
-- Adds fields to support quick scan (index-only) mode with lazy enrichment

-- Add needs_enrichment flag to staging_items
ALTER TABLE staging_items ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN DEFAULT TRUE;

-- Add timestamp for when enrichment was completed
ALTER TABLE staging_items ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;

-- Add ai_prompt_quick_list to app_settings for the new quick scan prompt
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_prompt_quick_list TEXT;
