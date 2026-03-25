-- Add side character dimension for better product taxonomy management.
ALTER TABLE items
ADD COLUMN IF NOT EXISTS side_character TEXT;

-- Prevent blank side character values when provided.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_side_character_not_blank_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_side_character_not_blank_check
    CHECK (side_character IS NULL OR btrim(side_character) <> '');
  END IF;
END $$;

-- Conservative backfill for existing records where naming is obvious.
UPDATE items
SET side_character = CASE
  WHEN name ~* '\bmega\s+earrings?\b' THEN 'Mega Earrings'
  WHEN name ~* '\bdangle\s+earrings?\b' THEN 'Dangle Earrings'
  WHEN name ~* '\bstud\s+earrings?\b' THEN 'Stud Earrings'
  WHEN name ~* '\bhoop\s+earrings?\b' THEN 'Hoop Earrings'
  WHEN name ~* '\bear\s*cuffs?\b' THEN 'Ear Cuff'
  WHEN name ~* '\bbrooch(?:es)?\b' THEN 'Brooch'
  WHEN name ~* '\bracelets?\b' THEN 'Bracelet'
  WHEN name ~* '\bnecklaces?\b' THEN 'Necklace'
  WHEN name ~* '\brings?\b' THEN 'Ring'
  ELSE side_character
END
WHERE side_character IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_character_side_character
ON items(line_type, character_family, side_character);

NOTIFY pgrst, 'reload schema';
