-- Events with invitation codes and guest registrations (påmelding)

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
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Active event pointer for the competition app
INSERT INTO app_state(key, text_value) VALUES ('active_event_slug', 'gulmasse-2026')
ON CONFLICT (key) DO NOTHING;

-- Seed Gulmasse 2026 (open for påmelding)
INSERT INTO events (
  slug,
  name,
  tagline,
  description,
  location,
  event_date,
  event_time,
  status,
  invite_code,
  registration_open
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
ON CONFLICT (slug) DO NOTHING;
