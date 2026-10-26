/** Canonical Gulmasse '25 results recovered from competition screenshots. */

export const YEAR_2025_ORDER = [
  'Tomas',
  'Konrad',
  'Roald',
  'Magnus',
  'Martin',
  'Adam',
] as const;

export type ScoreMatrix = {
  order: string[];
  cells: Record<string, Record<string, number>>;
};

export const YEAR_2025_BEER: ScoreMatrix = {
  order: [...YEAR_2025_ORDER],
  cells: {
    Tomas: { Tomas: 4, Konrad: 5, Roald: 4, Magnus: 3, Martin: 6, Adam: 6 },
    Konrad: { Tomas: 5, Konrad: 4, Roald: 5, Magnus: 3, Martin: 4, Adam: 2 },
    Roald: { Tomas: 5, Konrad: 3, Roald: 4, Magnus: 2, Martin: 5, Adam: 4 },
    Magnus: { Tomas: 4, Konrad: 5, Roald: 5, Magnus: 4, Martin: 5, Adam: 5 },
    Martin: { Tomas: 6, Konrad: 2, Roald: 5, Magnus: 3, Martin: 5, Adam: 5 },
    Adam: { Tomas: 4, Konrad: 3, Roald: 5, Magnus: 4, Martin: 5 },
  },
};

export const YEAR_2025_EXTRA: ScoreMatrix = {
  order: [...YEAR_2025_ORDER],
  cells: {
    Tomas: { Tomas: 3, Konrad: 6, Roald: 5, Magnus: 5, Martin: 6, Adam: 4 },
    Konrad: { Tomas: 4, Konrad: 4, Roald: 3, Magnus: 6, Martin: 6, Adam: 6 },
    Roald: { Tomas: 6, Konrad: 6, Roald: 2, Magnus: 5, Martin: 3, Adam: 5 },
    Magnus: { Tomas: 5, Konrad: 6, Roald: 6, Magnus: 4, Martin: 5, Adam: 5 },
    Martin: { Tomas: 6, Konrad: 5, Roald: 4, Magnus: 4, Martin: 3, Adam: 3 },
    Adam: { Tomas: 5, Konrad: 6, Roald: 6, Magnus: 3, Martin: 4 },
  },
};

export const YEAR_2025_COMBINED: ScoreMatrix = {
  order: [...YEAR_2025_ORDER],
  cells: {
    Tomas: { Tomas: 5.5, Konrad: 8.0, Roald: 6.5, Magnus: 5.5, Martin: 9.0, Adam: 8.0 },
    Konrad: { Tomas: 7.0, Konrad: 6.0, Roald: 6.5, Magnus: 6.0, Martin: 7.0, Adam: 5.0 },
    Roald: { Tomas: 8.0, Konrad: 6.0, Roald: 5.0, Magnus: 4.5, Martin: 6.5, Adam: 6.5 },
    Magnus: { Tomas: 6.5, Konrad: 8.0, Roald: 8.0, Magnus: 6.0, Martin: 7.5, Adam: 7.5 },
    Martin: { Tomas: 9.0, Konrad: 4.5, Roald: 7.0, Magnus: 5.0, Martin: 6.5, Adam: 6.5 },
    Adam: { Tomas: 6.5, Konrad: 6.0, Roald: 8.0, Magnus: 5.5, Martin: 7.0 },
  },
};

/** Final lobby ranking by combined points received */
export const YEAR_2025_STANDINGS = [
  { rank: 1, name: 'Martin', beer_name: 'Postludium', points: 43.5, given_points: 38.5, is_winner: true },
  { rank: 2, name: 'Tomas', beer_name: 'Cuvée Clarisse', points: 42.5, given_points: 42.5, is_winner: false },
  { rank: 3, name: 'Roald', beer_name: 'Tomasmesse', points: 41.0, given_points: 36.5, is_winner: false },
  { rank: 4, name: 'Konrad', beer_name: 'Winter Lager', points: 38.5, given_points: 37.5, is_winner: false },
  { rank: 5, name: 'Adam', beer_name: "S'MORBIDLY OBESE", points: 33.5, given_points: 33.0, is_winner: false },
  { rank: 6, name: 'Magnus', beer_name: 'Rudolf Brown Ale', points: 32.5, given_points: 43.5, is_winner: false },
] as const;
