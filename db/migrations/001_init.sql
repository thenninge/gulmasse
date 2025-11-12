-- Enable UUID generation if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- participants
CREATE TABLE IF NOT EXISTS participants (
  pin CHAR(4) PRIMARY KEY,
  nickname TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- votes
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin CHAR(4) REFERENCES participants(pin) ON DELETE CASCADE,
  round INT DEFAULT 1,
  value SMALLINT CHECK (value BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (round, pin)
);

-- picks
CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin CHAR(4) REFERENCES participants(pin) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- app_state
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  int_value INT,
  bool_value BOOLEAN,
  text_value TEXT
);

-- defaults for app_state keys
INSERT INTO app_state(key, int_value) VALUES ('current_round', 1)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_state(key, bool_value) VALUES ('reveal_results', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_state(key, bool_value) VALUES ('logins_locked', FALSE)
ON CONFLICT (key) DO NOTHING;


