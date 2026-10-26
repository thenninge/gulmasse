-- Lim inn i Supabase → SQL Editor → Run
-- Fyller Gulmasse '25 (Martin 43.5 osv.) i historikk.
-- Trygt å kjøre flere ganger.

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

ALTER TABLE year_editions
  ADD COLUMN IF NOT EXISTS beer_matrix JSONB,
  ADD COLUMN IF NOT EXISTS extra_matrix JSONB,
  ADD COLUMN IF NOT EXISTS combined_matrix JSONB,
  ADD COLUMN IF NOT EXISTS sum_factor NUMERIC(4,2) DEFAULT 0.5;

-- Anon-nøkkelen appen bruker må kunne lese/skrive
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
  name = EXCLUDED.name,
  event_date = EXCLUDED.event_date,
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

-- Sjekk at det ble riktig (skal vise 6 rader, Martin først)
SELECT ys.rank, ys.name, ys.beer_name, ys.points
FROM year_standings ys
JOIN year_editions ye ON ye.id = ys.edition_id
WHERE ye.year = 2025
ORDER BY ys.rank;
