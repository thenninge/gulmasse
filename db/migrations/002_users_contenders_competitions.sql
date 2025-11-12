-- Ensure UUID generator is available (already added in 001, harmless to repeat)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Contenders
CREATE TABLE IF NOT EXISTS contenders (
  c_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  c_name TEXT NOT NULL,
  c_score INT NOT NULL DEFAULT 0,     -- sum av poeng denne contenderen har fått
  c_number INT,                       -- valgfritt løpenummer
  c_rank INT,                         -- valgfritt rangeringstall
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- id-nr
  pin CHAR(4) UNIQUE NOT NULL,                         -- 4-sifret PIN
  nick TEXT,                                           -- kallenavn
  c_id UUID REFERENCES contenders(c_id) ON DELETE SET NULL, -- kobling til contender
  u_score INT NOT NULL DEFAULT 0,                      -- løpende sum poeng gitt av brukeren
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitions (liste av brukere via join-tabell)
CREATE TABLE IF NOT EXISTS competitions (
  comp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competition_users (
  comp_id UUID REFERENCES competitions(comp_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (comp_id, user_id)
);


