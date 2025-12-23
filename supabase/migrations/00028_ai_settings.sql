-- Add AI Import settings columns to app_settings table
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS ai_selected_model text DEFAULT 'gemini-2.0-flash',
ADD COLUMN IF NOT EXISTS ai_prompt_category text,
ADD COLUMN IF NOT EXISTS ai_prompt_subcategory text,
ADD COLUMN IF NOT EXISTS ai_prompt_product_list text,
ADD COLUMN IF NOT EXISTS ai_prompt_product_detail text;

-- Add checking mechanism to ensure only one row exists (just in case, though usually enforced elsewhere)
-- existing policies usually cover this for single-row settings table
