ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS original_start_date DATE,
ADD COLUMN IF NOT EXISTS original_end_date DATE,
ADD COLUMN IF NOT EXISTS event_location TEXT;

UPDATE reservations
SET
  original_start_date = COALESCE(original_start_date, start_date),
  original_end_date = COALESCE(original_end_date, end_date)
WHERE original_start_date IS NULL
   OR original_end_date IS NULL;

UPDATE reservations
SET event_location = COALESCE(
  NULLIF(BTRIM(event_location), ''),
  NULLIF(BTRIM(CONCAT_WS(
    ', ',
    NULLIF(BTRIM(address_line1), ''),
    NULLIF(BTRIM(address_line2), ''),
    NULLIF(BTRIM(CONCAT_WS(', ', NULLIF(BTRIM(city_region), ''), NULLIF(BTRIM(postcode), ''))), ''),
    NULLIF(BTRIM(country), '')
  )), '')
)
WHERE event_location IS NULL
   OR BTRIM(event_location) = '';
