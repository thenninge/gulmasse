-- Add recipient tracking to votes so points can be assigned to the selected participant
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS recipient_pin CHAR(4) REFERENCES participants(pin) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_votes_recipient_pin ON votes(recipient_pin);


