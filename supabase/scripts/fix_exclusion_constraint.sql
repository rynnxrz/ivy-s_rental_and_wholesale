-- Drop the strict exclusion constraint that blocks pending keys
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_item_id_tstzrange_excl;

-- Ideally, we only want to block overlapping *confirmed* or *active* reservations.
-- Postgres exclusion constraints are powerful but adding a WHERE clause to them requires a bit more syntax or a partial index approach.
-- For simplicity, we can rely on the `check_item_availability` function before insertion (which we do in UI).
-- But to prevent double booking at DB level, we can add a constraint that applies ONLY when status is NOT pending.

-- A common way is using a conditional exclusion constraint, but "status != 'pending'" logic inside EXCLUDE can be tricky if status changes.
-- Correct approach for B2B rental: Allow multiple PENDINGs. Enforce NO OVERLAP for 'confirmed' | 'active'.

-- Note: We need the 'btree_gist' extension for this.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
ADD CONSTRAINT no_overlap_confirmed_active
EXCLUDE USING gist (
  item_id WITH =,
  tstzrange(start_date::timestamptz, end_date::timestamptz, '[]') WITH &&
)
WHERE (status IN ('confirmed', 'active'));
