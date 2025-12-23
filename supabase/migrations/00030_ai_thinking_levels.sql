-- Add thinking level preferences for AI prompts
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS ai_thinking_category text,
ADD COLUMN IF NOT EXISTS ai_thinking_subcategory text,
ADD COLUMN IF NOT EXISTS ai_thinking_product_list text,
ADD COLUMN IF NOT EXISTS ai_thinking_product_detail text;
