/**
 * Results export for «Full oversikt». Built for Norwegian Excel / Numbers:
 * semicolon separator, decimal comma, UTF-8 BOM (so «Ø» shows correctly).
 * PINs are deliberately left out of the file.
 */
export type ExportParticipant = {
  pin: string;
  nickname: string | null;
  beer_name?: string | null;
  producer?: string | null;
  beer_type?: string | null;
  abv?: number | null;
};
type PairMap = Record<string, Record<string, number>>;

export type ResultRow = {
  place: number;
  pin: string;
  name: string;
  beer: string;
  producer: string;
  type: string;
  abv: number | null;
  beerPoints: number;
  extraPoints: number;
  sum: number;
};

const nameOf = (p: ExportParticipant) => (p.nickname || '').trim() || p.pin;

/** Ranking identical to the award ceremony: sum, then beer points, then name. */
export function computeResults(participants: ExportParticipant[], pair: PairMap, extra: PairMap, factor: number): ResultRow[] {
  const recv = (m: PairMap, pin: string) =>
    Object.values(m || {}).reduce((acc, row) => acc + (Number(row?.[pin]) || 0), 0);
  const rows = participants.map((p) => {
    const beerPoints = recv(pair, p.pin);
    const extraPoints = recv(extra, p.pin);
    const abv = p.abv != null && Number.isFinite(Number(p.abv)) ? Number(p.abv) : null;
    return {
      place: 0,
      pin: p.pin,
      name: nameOf(p),
      beer: (p.beer_name || '').trim(),
      producer: (p.producer || '').trim(),
      type: (p.beer_type || '').trim(),
      abv,
      beerPoints,
      extraPoints,
      sum: beerPoints + factor * extraPoints,
    };
  });
  rows.sort((a, b) => b.sum - a.sum || b.beerPoints - a.beerPoints || a.name.localeCompare(b.name, 'nb'));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    // Shared place when both sum and beer points are equal
    r.place = prev && prev.sum === r.sum && prev.beerPoints === r.beerPoints ? prev.place : i + 1;
  });
  return rows;
}

function num(v: number | null | undefined, decimals?: number): string {
  if (v == null || !Number.isFinite(v)) return '';
  const s = decimals != null ? v.toFixed(decimals) : String(Math.round(v * 100) / 100);
  return s.replace('.', ',');
}

function cell(v: string | number): string {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (cells: Array<string | number>) => cells.map(cell).join(';');

function matrix(title: string, participants: ExportParticipant[], m: PairMap): string[] {
  const names = participants.map(nameOf);
  const out = [line([title]), line(['Ga ↓ / Fikk →', ...names, 'Sum gitt'])];
  const colSums = participants.map(() => 0);
  for (const from of participants) {
    const vals = participants.map((to, j) => {
      const v = Number(m?.[from.pin]?.[to.pin]) || 0;
      colSums[j] += v;
      return v;
    });
    out.push(line([nameOf(from), ...vals.map((v) => num(v)), num(vals.reduce((a, b) => a + b, 0))]));
  }
  out.push(line(['Sum fått', ...colSums.map((v) => num(v)), num(colSums.reduce((a, b) => a + b, 0))]));
  return out;
}

export function buildResultsCsv(opts: {
  participants: ExportParticipant[];
  pair: PairMap;
  extra: PairMap;
  factor: number;
}): string {
  const { participants, pair, extra, factor } = opts;
  const results = computeResults(participants, pair, extra, factor);
  const factorTxt = num(factor);
  const lines: string[] = [
    line(['Plass', 'Navn', 'Ølnavn', 'Bryggeri', 'Øltype', 'Alkohol (%)', 'Terningpoeng', 'Ekstrapoeng', `Sum (terning + ${factorTxt} × ekstra)`]),
    ...results.map((r) =>
      line([r.place, r.name, r.beer, r.producer, r.type, num(r.abv, 1), num(r.beerPoints), num(r.extraPoints), num(r.sum, 1)]),
    ),
    '',
    ...matrix('Terningpoeng – hvem ga hva til hvem', participants, pair),
    '',
    ...matrix('Ekstrapoeng – hvem ga hva til hvem', participants, extra),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
