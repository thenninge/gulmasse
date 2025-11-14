-- Additional score category for general experience/pitch/label/x-factor
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS extra_value SMALLINT CHECK (extra_value BETWEEN 1 AND 6);


