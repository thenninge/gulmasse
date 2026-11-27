/**
 * While a participant is presenting and no votes have come in yet, the
 * commentator fills the gap with stats and the same info as the lobby's
 * participant page (lib/participantBios).
 */
import type { Lang } from '@/lib/leaderboardI18n';
import { getProfile } from '@/lib/participantBios';

export type InfoItem =
  | { type: 'beer'; name: string; beer: string; producer: string; beerType: string; abv: number | null }
  | { type: 'target'; name: string; bestBeer: string; bestName: string; avg: number }
  | { type: 'giver'; name: string; avg: number; votes: number }
  | { type: 'bio'; name: string; text: string }
  | { type: 'facts'; name: string; facts: string[] };

type BoardLike = {
  presenter: null | { pin: string; name: string; beer: string; producer: string; type: string; abv: number | null };
  best: null | { name: string; beer: string; avgBeer: number | null };
  givers?: Array<{ pin: string; votes: number; beerGiven: number }>;
};

/** The lines to tell about the current presenter, in order: stats interleaved with the bio. */
export function buildInfoQueue(board: BoardLike): InfoItem[] {
  const p = board.presenter;
  if (!p) return [];
  const stats: InfoItem[] = [];
  if (p.beer && (p.producer || p.type || p.abv != null)) {
    stats.push({ type: 'beer', name: p.name, beer: p.beer, producer: p.producer, beerType: p.type, abv: p.abv });
  }
  if (board.best && board.best.avgBeer != null && board.best.beer) {
    stats.push({ type: 'target', name: p.name, bestBeer: board.best.beer, bestName: board.best.name, avg: board.best.avgBeer });
  }
  const g = board.givers?.find((x) => x.pin === p.pin);
  if (g && g.votes > 0) stats.push({ type: 'giver', name: p.name, avg: g.beerGiven / g.votes, votes: g.votes });

  const profile = getProfile(p.name);
  const bio: InfoItem[] = (profile?.bio ?? []).map((text) => ({ type: 'bio', name: p.name, text }));
  const out: InfoItem[] = [];
  for (let i = 0; i < Math.max(stats.length, bio.length); i++) {
    if (stats[i]) out.push(stats[i]);
    if (bio[i]) out.push(bio[i]);
  }
  if (profile?.facts.length) out.push({ type: 'facts', name: p.name, facts: profile.facts });
  return out;
}

/** Bios are written in Norwegian only – in EN/JP those lines are left out. */
export const infoShown = (lang: Lang, item: InfoItem) => lang === 'no' || (item.type !== 'bio' && item.type !== 'facts');

export function infoText(lang: Lang, item: InfoItem, f: (n: number | null | undefined, d?: number) => string): string {
  switch (item.type) {
    case 'beer': {
      const abv = item.abv != null ? `${f(item.abv, 1)} %` : '';
      const parts = [item.beerType, abv].filter(Boolean).join(', ');
      if (lang === 'en') return `About the beer: ${item.beer}${item.producer ? ` from ${item.producer}` : ''}${parts ? ` – ${parts}` : ''}. Let's see what the room thinks!`;
      if (lang === 'ja') return `ビールについて：${item.beer}${item.producer ? `（${item.producer}）` : ''}${parts ? ` – ${parts}` : ''}。会場の評価はいかに！`;
      return `Om ølet: ${item.beer}${item.producer ? ` fra ${item.producer}` : ''}${parts ? ` – ${parts}` : ''}. Får se hva salen mener!`;
    }
    case 'target':
      if (lang === 'en') return `The one to beat: ${item.bestBeer} (${item.bestName}) has the best average of the night so far – ${f(item.avg, 2)}. Can ${item.name} top it?`;
      if (lang === 'ja') return `倒すべき相手：${item.bestBeer}（${item.bestName}）が今夜の最高平均 – ${f(item.avg, 2)}。${item.name}は超えられるか？`;
      return `Det er dette som må slås: ${item.bestBeer} (${item.bestName}) har kveldens beste snitt så langt – ${f(item.avg, 2)}. Klarer ${item.name} det?`;
    case 'giver':
      if (lang === 'en') return `As a judge, ${item.name} has given an average of ${f(item.avg, 2)} for the beers so far. Strict or kind? Now we'll see if it comes back around!`;
      if (lang === 'ja') return `審査員としての${item.name}は、ここまでビールに平均${f(item.avg, 2)}点。厳しい？優しい？それが返ってくるか見ものだ！`;
      return `Som dommer har ${item.name} så langt gitt ${f(item.avg, 2)} i snitt på ølene. Streng eller snill? Nå får vi se om det slår tilbake!`;
    case 'bio':
      return item.text;
    case 'facts':
      return `Raske fakta om ${item.name}: ${item.facts.join(' · ')}`;
  }
}
