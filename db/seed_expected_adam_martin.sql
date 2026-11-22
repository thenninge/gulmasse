-- Lim inn i Supabase → SQL Editor → Run
-- Adam + Martin som forventede gjester (uten PIN/øl).
-- De vises i lobby til de oppretter egen bruker.

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

ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE events TO anon, authenticated, service_role;
GRANT ALL ON TABLE event_registrations TO anon, authenticated, service_role;

INSERT INTO app_state(key, text_value) VALUES ('active_event_slug', 'gulmasse-2026')
ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;

INSERT INTO events (
  slug, name, tagline, event_date, status, invite_code, registration_open
) VALUES (
  'gulmasse-2026',
  'Gulmasse ''26',
  'Christmas Beer Competition',
  '2026-11-28',
  'registration',
  'GULMASSE26',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  status = 'registration',
  registration_open = TRUE;

-- Insert Adam / Martin if no active (non-cancelled) row with same name exists
INSERT INTO event_registrations (event_id, name, status, bringing_beer, responded_at)
SELECT e.id, v.name, 'accepted', TRUE, NOW()
FROM events e
CROSS JOIN (VALUES ('Adam'), ('Martin')) AS v(name)
WHERE e.slug = 'gulmasse-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM event_registrations r
    WHERE r.event_id = e.id
      AND r.status <> 'cancelled'
      AND lower(trim(r.name)) = lower(v.name)
  );

SELECT r.name, r.status, r.participant_pin
FROM event_registrations r
JOIN events e ON e.id = r.event_id
WHERE e.slug = 'gulmasse-2026'
  AND r.status <> 'cancelled'
ORDER BY r.name;
