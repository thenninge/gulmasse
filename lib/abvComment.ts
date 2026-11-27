/**
 * Strength remarks: under 6 % («butikkøl?») and 10 % or more («kvasiing»).
 * Used by the commentator (right after the pick) and the lobby info page.
 */
type Lang3 = 'no' | 'en' | 'ja';
export const ABV_LOW = 6;
export const ABV_HIGH = 10;

export function abvKind(abv: number | null | undefined): 'abvLow' | 'abvHigh' | null {
  if (abv == null || !Number.isFinite(abv) || abv <= 0) return null;
  if (abv < ABV_LOW) return 'abvLow';
  if (abv >= ABV_HIGH) return 'abvHigh';
  return null;
}

export function abvText(lang: Lang3, abv: number, fmt: (n: number) => string): string | null {
  const k = abvKind(abv);
  if (!k) return null;
  const a = fmt(abv);
  if (k === 'abvLow') {
    if (lang === 'en') return `${a} %.. Supermarket beer? In an open competition? This contestant must be asking to get skinned alive! Afraid of the dark, this person clearly is not!`;
    if (lang === 'ja') return `${a}%…スーパーのビール？オープンな大会で？この参加者は叩きのめされたいに違いない！怖いもの知らずだ！`;
    return `${a} %.. Altså,.. butikkøl? På en åpen konkurranse? Deltakeren må jo ha et ønske om å bli flådd! Mørkredd er denne personen åpenbart ikke!`;
  }
  if (lang === 'en') return `Ooooh yes – a ${a}% heavyweight on the way now.. Statistics say it can easily backfire – on the points and in other ways! I wonder where the dice will land here.`;
  if (lang === 'ja') return `おおお – ${a}%の強烈なのが来たぞ…統計的には、点数でもそれ以外でも逆噴射しやすい！サイコロはどこに転がる？`;
  return `Åååjaa – her er det en kvasiing på ${a} % på gang nå.. Statistikken tilsier at det fort kan gi bakblåst både i poengveien og andre veier! Mon tro hva terningene ramler ned på her.`;
}
