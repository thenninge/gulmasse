-- Add participant profile fields for beer details
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS beer_name TEXT,
  ADD COLUMN IF NOT EXISTS producer TEXT,
  ADD COLUMN IF NOT EXISTS beer_type TEXT,
  ADD COLUMN IF NOT EXISTS abv NUMERIC(4,1);


