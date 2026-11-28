/**
 * Every beer's strength gets a remark (right after the pick on the leaderboard,
 * and on the lobby info page). Tiers:
 *   under 6 %      «butikkøl?»
 *   6 – under 8 %  light – can get lucky with the presentation order
 *   8 – 10 %       solid
 *   over 10 %      the full «kvasiing» outburst
 * Several variants per tier, picked by a stable seed so lines don't repeat beer after beer.
 */
type Lang3 = 'no' | 'en' | 'ja';
export type AbvTier = 'abvLow' | 'abvLight' | 'abvMid' | 'abvHigh';

export function abvKind(abv: number | null | undefined): AbvTier | null {
  if (abv == null || !Number.isFinite(abv) || abv <= 0) return null;
  if (abv < 6) return 'abvLow';
  if (abv < 8) return 'abvLight';
  if (abv <= 10) return 'abvMid';
  return 'abvHigh';
}

export const abvIcon = (tier: AbvTier) => ({ abvLow: '🥤', abvLight: '🍃', abvMid: '🍺', abvHigh: '🔥' })[tier];

const LINES: Record<AbvTier, Record<Lang3, string[]>> = {
  abvLow: {
    no: [
      '{abv} %.. Altså,.. butikkøl? På en åpen konkurranse? Deltakeren må jo ha et ønske om å bli flådd! Mørkredd er denne personen åpenbart ikke!',
      'Bare {abv} %?! Dette er jo nesten saft! Her må presentasjonen gjøre en heltemodig innsats, folkens!',
    ],
    en: [
      '{abv} %.. Supermarket beer? In an open competition? This contestant must be asking to get skinned alive! Afraid of the dark, this person clearly is not!',
      'Only {abv} %?! That\'s practically juice! The presentation will need a heroic effort here, folks!',
    ],
    ja: [
      '{abv}%…スーパーのビール？オープンな大会で？この参加者は叩きのめされたいに違いない！怖いもの知らずだ！',
      'たった{abv}%？！ほぼジュースだ！ここはプレゼンの奮闘に期待するしかない！',
    ],
  },
  abvLight: {
    no: [
      'Kun {abv} % på denne! Det kan slå heldig inn om presentasjonsrekkefølgen faller heldig ut..',
      '{abv} % – en lettvekter i juleølsammenheng! Tidlig i kvelden er ganen fortsatt skarp – sent i kvelden kan den drukne i tyngre saker..',
      'Moderate {abv} %. Elegant og drikkbart – eller blir den overkjørt av de tunge kanonene?',
    ],
    en: [
      'Only {abv} % on this one! It could work out nicely if the presentation order falls kindly..',
      '{abv} % – a lightweight by Christmas-beer standards! Early in the evening the palate is still sharp – late in the evening it can drown among the heavier stuff..',
      'A moderate {abv} %. Elegant and drinkable – or will it be run over by the big guns?',
    ],
    ja: [
      'このビールはたった{abv}%！プレゼンの順番が良ければ、うまくいくかも…',
      '{abv}% – クリスマスビールとしては軽量級！序盤なら舌はまだ鋭い – 終盤なら重いビールに埋もれるかも…',
      '控えめな{abv}%。上品で飲みやすい – それとも重量級に押し潰される？',
    ],
  },
  abvMid: {
    no: [
      '{abv} % – solid juleølstyrke! Her er det kropp nok til å tåle et par ribbebiter.',
      '{abv} % i glasset. Midt i blinken for en juleøl – nå er det smaken som må avgjøre!',
      'Respektable {abv} %! Dette er en øl som mener alvor – og stemmene vil merke det.',
    ],
    en: [
      '{abv} % – a solid Christmas-beer strength! Enough body to stand up to some pork ribs.',
      '{abv} % in the glass. Right on target for a Christmas beer – now the taste must decide!',
      'A respectable {abv} %! This beer means business – and the votes will feel it.',
    ],
    ja: [
      '{abv}% – しっかりしたクリスマスビールの強さ！リブにも負けないボディ。',
      'グラスの中は{abv}%。クリスマスビールとしてど真ん中 – あとは味で勝負！',
      '立派な{abv}%！本気のビールだ – 投票にも響くはず。',
    ],
  },
  abvHigh: {
    no: [
      'Åååjaa – her er det en kvasiing på {abv} % på gang nå.. Statistikken tilsier at det fort kan gi bakblåst både i poengveien og andre veier! Mon tro hva terningene ramler ned på her.',
    ],
    en: [
      'Ooooh yes – a {abv} % heavyweight on the way now.. Statistics say it can easily backfire – on the points and in other ways! I wonder where the dice will land here.',
    ],
    ja: [
      'おおお – {abv}%の強烈なのが来たぞ…統計的には、点数でもそれ以外でも逆噴射しやすい！サイコロはどこに転がる？',
    ],
  },
};

/** Stable small number from a string (e.g. the beer name) */
export const seedOf = (s: string) => [...(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

export function abvText(lang: Lang3, abv: number, fmt: (n: number) => string, seed = 0): string | null {
  const k = abvKind(abv);
  if (!k) return null;
  const pool = LINES[k][lang];
  return pool[Math.abs(seed) % pool.length].replace(/\{abv\}/g, fmt(abv));
}
