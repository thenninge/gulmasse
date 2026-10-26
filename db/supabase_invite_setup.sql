-- Paste this into Supabase → SQL Editor → Run
-- Sets up events, påmelding, and Gulmasse '25/'26 seed data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  location TEXT,
  event_date DATE,
  event_time TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'registration', 'live', 'archived')),
  invite_code TEXT UNIQUE NOT NULL,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  max_participants INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  beer_matrix JSONB,
  extra_matrix JSONB,
  combined_matrix JSONB,
  sum_factor NUMERIC(4,2) DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('invited', 'accepted', 'declined', 'waitlist', 'cancelled')),
  bringing_beer BOOLEAN DEFAULT TRUE,
  beer_note TEXT,
  message TEXT,
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  participant_pin CHAR(4) REFERENCES participants(pin) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event
  ON event_registrations(event_id);

CREATE INDEX IF NOT EXISTS idx_event_registrations_status
  ON event_registrations(event_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_email_unique
  ON event_registrations(event_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

INSERT INTO app_state(key, text_value) VALUES ('active_event_slug', 'gulmasse-2026')
ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;

INSERT INTO events (
  slug, name, tagline, description, location, event_date, event_time,
  status, invite_code, registration_open
) VALUES (
  'gulmasse-2026',
  'Gulmasse ''26',
  'Christmas Beer Competition',
  'Det er en juleøl-event. Istedenfor å komme på juleølsmaking, skal du som deltaker ta med en juleøl du mener kan være årets beste!',
  NULL,
  '2026-11-28',
  NULL,
  'registration',
  'GULMASSE26',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  event_date = EXCLUDED.event_date,
  status = EXCLUDED.status,
  registration_open = EXCLUDED.registration_open,
  description = EXCLUDED.description;

-- Year history tables
CREATE TABLE IF NOT EXISTS year_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  beer_matrix JSONB,
  extra_matrix JSONB,
  combined_matrix JSONB,
  sum_factor NUMERIC(4,2) DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS year_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES year_editions(id) ON DELETE CASCADE,
  rank INT NOT NULL,
  name TEXT NOT NULL,
  beer_name TEXT,
  producer TEXT,
  beer_type TEXT,
  abv NUMERIC(4,1),
  points NUMERIC(8,2) NOT NULL DEFAULT 0,
  given_points NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (edition_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_year_standings_edition
  ON year_standings(edition_id, rank);

GRANT SELECT, INSERT, UPDATE, DELETE ON year_editions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON year_standings TO anon, authenticated, service_role;

INSERT INTO year_editions (year, name, event_date, notes, sum_factor)
VALUES (
  2025,
  'Gulmasse ''25',
  '2025-12-13',
  'Endelig stilling – Martin vant med Postludium (43.5). Factor (extra) = 0.5.',
  0.5
)
ON CONFLICT (year) DO UPDATE SET
  notes = EXCLUDED.notes,
  sum_factor = EXCLUDED.sum_factor;

DELETE FROM year_standings
WHERE edition_id IN (SELECT id FROM year_editions WHERE year = 2025);

INSERT INTO year_standings (
  edition_id, rank, name, beer_name, points, given_points, is_winner
)
SELECT e.id, s.rank, s.name, s.beer_name, s.points, s.given_points, s.is_winner
FROM year_editions e
CROSS JOIN (
  VALUES
    (1, 'Martin', 'Postludium',           43.5::numeric, 38.5::numeric, TRUE),
    (2, 'Tomas',  'Cuvée Clarisse',       42.5::numeric, 42.5::numeric, FALSE),
    (3, 'Roald',  'Tomasmesse',           41.0::numeric, 36.5::numeric, FALSE),
    (4, 'Konrad', 'Winter Lager',         38.5::numeric, 37.5::numeric, FALSE),
    (5, 'Adam',   'S''MORBIDLY OBESE',    33.5::numeric, 33.0::numeric, FALSE),
    (6, 'Magnus', 'Rudolf Brown Ale',     32.5::numeric, 43.5::numeric, FALSE)
) AS s(rank, name, beer_name, points, given_points, is_winner)
WHERE e.year = 2025;

-- Optional clean slate for live competition (keeps year_standings history).
-- Uncomment to wipe last year's participants/scores from the live app:
-- DELETE FROM votes;
-- DELETE FROM picks;
-- DELETE FROM participants WHERE pin <> '0808';
-- INSERT INTO app_state(key, text_value) VALUES ('active_event_slug', 'gulmasse-2026')
-- ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;
