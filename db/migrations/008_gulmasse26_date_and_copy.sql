-- Ensure Gulmasse '26 date and copy are correct (safe if 007 already applied)
UPDATE events
SET
  event_date = '2026-11-28',
  tagline = 'Christmas Beer Competition',
  description = 'Det er en juleøl-event. Istedenfor å komme på juleølsmaking, skal du som deltaker ta med en juleøl du mener kan være årets beste!',
  status = 'registration',
  registration_open = TRUE
WHERE slug = 'gulmasse-2026';

INSERT INTO app_state(key, text_value) VALUES ('active_event_slug', 'gulmasse-2026')
ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;
