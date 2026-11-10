-- Prevent one PIN linking to multiple registrations on the same event,
-- and support cleaning name-duplicates in app code (status = cancelled).

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_pin_unique
  ON event_registrations(event_id, participant_pin)
  WHERE participant_pin IS NOT NULL;
