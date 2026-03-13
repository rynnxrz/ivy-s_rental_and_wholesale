-- Add Ivy taxonomy dimensions to items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'Mainline',
ADD COLUMN IF NOT EXISTS character_family TEXT NOT NULL DEFAULT 'Uncategorized';

-- Constrain line_type to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_line_type_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_line_type_check
    CHECK (line_type IN ('Mainline', 'Collaboration', 'Archive'));
  END IF;
END $$;

-- Prevent empty character family labels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_character_family_not_blank_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_character_family_not_blank_check
    CHECK (btrim(character_family) <> '');
  END IF;
END $$;

-- Normalize any legacy rows
UPDATE items
SET line_type = 'Mainline'
WHERE line_type IS NULL
   OR line_type NOT IN ('Mainline', 'Collaboration', 'Archive');

UPDATE items
SET character_family = 'Uncategorized'
WHERE character_family IS NULL
   OR btrim(character_family) = '';

-- Useful indexes for admin grouping/filtering
CREATE INDEX IF NOT EXISTS idx_items_line_type ON items(line_type);
CREATE INDEX IF NOT EXISTS idx_items_character_family ON items(character_family);

NOTIFY pgrst, 'reload schema';
