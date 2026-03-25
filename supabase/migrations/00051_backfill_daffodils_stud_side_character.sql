-- Normalize Daffodils Blossom stud variants into Side Character = Stud Earrings.
UPDATE items
SET side_character = 'Stud Earrings'
WHERE character_family = 'Daffodils Blossom'
  AND (
    COALESCE(name, '') ~* '\bstud\s+earrings?\b'
    OR COALESCE(description, '') ~* '\bstud\s+earrings?\b'
  );

NOTIFY pgrst, 'reload schema';
