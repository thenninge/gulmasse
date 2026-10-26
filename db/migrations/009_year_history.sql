-- Historical year results (podium + points) for previous Gulmasse editions

CREATE TABLE IF NOT EXISTS year_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Seed Gulmasse '25 (names from the 2025 app; update points in admin if needed)
INSERT INTO year_editions (year, name, event_date, notes)
VALUES (
  2025,
  'Gulmasse ''25',
  '2025-12-13',
  'Christmas Beer Competition 2025'
)
ON CONFLICT (year) DO NOTHING;

-- Placeholder standings for '25 – ranks/points can be corrected in admin
INSERT INTO year_standings (edition_id, rank, name, beer_name, points, given_points, is_winner)
SELECT e.id, s.rank, s.name, s.beer_name, s.points, s.given_points, s.is_winner
FROM year_editions e
CROSS JOIN (
  VALUES
    (1, 'Magnus', NULL::text, 0::numeric, 0::numeric, TRUE),
    (2, 'Kathinka', NULL::text, 0::numeric, 0::numeric, FALSE),
    (3, 'Tomas', NULL::text, 0::numeric, 0::numeric, FALSE),
    (4, 'Eirik', NULL::text, 0::numeric, 0::numeric, FALSE),
    (5, 'Adam', NULL::text, 0::numeric, 0::numeric, FALSE),
    (6, 'Martin', NULL::text, 0::numeric, 0::numeric, FALSE),
    (7, 'Konrad', NULL::text, 0::numeric, 0::numeric, FALSE),
    (8, 'Roald', NULL::text, 0::numeric, 0::numeric, FALSE)
) AS s(rank, name, beer_name, points, given_points, is_winner)
WHERE e.year = 2025
  AND NOT EXISTS (
    SELECT 1 FROM year_standings ys WHERE ys.edition_id = e.id
  );
