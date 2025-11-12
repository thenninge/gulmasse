-- Offsets to allow resetting displayed totals without mutating historical votes
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS given_offset INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_offset INT DEFAULT 0;


