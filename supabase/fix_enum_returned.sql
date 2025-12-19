-- Add 'returned' to reservation_status enum
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'returned';
