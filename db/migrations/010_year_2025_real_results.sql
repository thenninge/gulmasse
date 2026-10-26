-- Replace placeholder 2025 standings with real results from the competition screenshots.
-- Matrices: giver → receiver. Factor for combined = main + 0.5 * extra.

ALTER TABLE year_editions
  ADD COLUMN IF NOT EXISTS beer_matrix JSONB,
  ADD COLUMN IF NOT EXISTS extra_matrix JSONB,
  ADD COLUMN IF NOT EXISTS combined_matrix JSONB,
  ADD COLUMN IF NOT EXISTS sum_factor NUMERIC(4,2) DEFAULT 0.5;

UPDATE year_editions
SET
  name = 'Gulmasse ''25',
  event_date = '2025-12-13',
  notes = 'Endelig stilling – Martin vant med Postludium (43.5). Factor (extra) = 0.5.',
  sum_factor = 0.5,
  beer_matrix = '{
    "order": ["Tomas","Konrad","Roald","Magnus","Martin","Adam"],
    "cells": {
      "Tomas":  {"Tomas":4,   "Konrad":5,   "Roald":4,   "Magnus":3,   "Martin":6,   "Adam":6},
      "Konrad": {"Tomas":5,   "Konrad":4,   "Roald":5,   "Magnus":3,   "Martin":4,   "Adam":2},
      "Roald":  {"Tomas":5,   "Konrad":3,   "Roald":4,   "Magnus":2,   "Martin":5,   "Adam":4},
      "Magnus": {"Tomas":4,   "Konrad":5,   "Roald":5,   "Magnus":4,   "Martin":5,   "Adam":5},
      "Martin": {"Tomas":6,   "Konrad":2,   "Roald":5,   "Magnus":3,   "Martin":5,   "Adam":5},
      "Adam":   {"Tomas":4,   "Konrad":3,   "Roald":5,   "Magnus":4,   "Martin":5}
    }
  }'::jsonb,
  extra_matrix = '{
    "order": ["Tomas","Konrad","Roald","Magnus","Martin","Adam"],
    "cells": {
      "Tomas":  {"Tomas":3,   "Konrad":6,   "Roald":5,   "Magnus":5,   "Martin":6,   "Adam":4},
      "Konrad": {"Tomas":4,   "Konrad":4,   "Roald":3,   "Magnus":6,   "Martin":6,   "Adam":6},
      "Roald":  {"Tomas":6,   "Konrad":6,   "Roald":2,   "Magnus":5,   "Martin":3,   "Adam":5},
      "Magnus": {"Tomas":5,   "Konrad":6,   "Roald":6,   "Magnus":4,   "Martin":5,   "Adam":5},
      "Martin": {"Tomas":6,   "Konrad":5,   "Roald":4,   "Magnus":4,   "Martin":3,   "Adam":3},
      "Adam":   {"Tomas":5,   "Konrad":6,   "Roald":6,   "Magnus":3,   "Martin":4}
    }
  }'::jsonb,
  combined_matrix = '{
    "order": ["Tomas","Konrad","Roald","Magnus","Martin","Adam"],
    "cells": {
      "Tomas":  {"Tomas":5.5, "Konrad":8.0, "Roald":6.5, "Magnus":5.5, "Martin":9.0, "Adam":8.0},
      "Konrad": {"Tomas":7.0, "Konrad":6.0, "Roald":6.5, "Magnus":6.0, "Martin":7.0, "Adam":5.0},
      "Roald":  {"Tomas":8.0, "Konrad":6.0, "Roald":5.0, "Magnus":4.5, "Martin":6.5, "Adam":6.5},
      "Magnus": {"Tomas":6.5, "Konrad":8.0, "Roald":8.0, "Magnus":6.0, "Martin":7.5, "Adam":7.5},
      "Martin": {"Tomas":9.0, "Konrad":4.5, "Roald":7.0, "Magnus":5.0, "Martin":6.5, "Adam":6.5},
      "Adam":   {"Tomas":6.5, "Konrad":6.0, "Roald":8.0, "Magnus":5.5, "Martin":7.0}
    }
  }'::jsonb
WHERE year = 2025;

-- Clear placeholder standings and insert real podium order (by combined received)
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
