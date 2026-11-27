/**
 * Beers that have been in Gulmasse before – from the host's spreadsheet.
 * Matched on this year's beer name, so it works whoever brings it.
 */
type Lang3 = 'no' | 'en' | 'ja';

export type BeerHistory = {
  title: string;
  rows: Array<{ year: number; place: Record<Lang3, string>; by: string }>;
  /** one-line story for the info page */
  summary: Record<Lang3, string>;
  /** commentator lines when the beer is picked ({name} = this year's presenter) */
  pick: Record<Lang3, string[]>;
};

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const HISTORY: Array<{ match: (n: string) => boolean; h: BeerHistory }> = [
  {
    match: (n) => n.includes('delirium'),
    h: {
      title: 'Delirium Christmas',
      rows: [
        { year: 2021, by: 'Kathinka', place: { no: '1. plass – både på smak og offisielt (11 øl)', en: '1st – on taste and officially (11 beers)', ja: '1位 – 味・公式ともに（11本中）' } },
        { year: 2022, by: 'Adam', place: { no: '5. plass – både på smak og offisielt (10 øl)', en: '5th – on taste and officially (10 beers)', ja: '5位 – 味・公式ともに（10本中）' } },
      ],
      summary: {
        no: 'Vinnerølet fra 2021 – men da Adam stilte den i 2022, falt den til midtfeltet. Hvilken Delirium får vi i år?',
        en: 'The 2021 winner – but when Adam brought it in 2022 it dropped to mid-table. Which Delirium do we get this year?',
        ja: '2021年の優勝ビール – でも2022年にアダムが持ってきた時は中位に後退。今年はどっちのデリリウム？',
      },
      pick: {
        no: [
          'Historikk: Delirium Christmas vant i 2021 (Kathinka) – men ble bare nr. 5 da Adam stilte den i 2022. Kan {name} gi den gullet tilbake?!',
          'Delirium Christmas er en gammel kjenning! Fra vinner i 2021 til midtfeltet i 2022.. Andre gang har aldri vært lett for denne!',
        ],
        en: [
          'History: Delirium Christmas won in 2021 (Kathinka) – but only came 5th when Adam brought it in 2022. Can {name} win back the gold?!',
          'Delirium Christmas is an old friend! From winner in 2021 to mid-table in 2022.. second time round has never been easy for this one!',
        ],
        ja: [
          '歴史：デリリウム・クリスマスは2021年に優勝（カティンカ）– でも2022年にアダムが持ってきた時は5位。{name}は金メダルを取り戻せるか？！',
          'デリリウム・クリスマスはおなじみ！2021年の優勝から2022年は中位へ…2回目はいつも苦戦！',
        ],
      },
    },
  },
  {
    match: (n) => n.includes('perenoel') || n.includes('pernoel'),
    h: {
      title: 'Père Noël (De Ranke)',
      rows: [
        { year: 2021, by: 'Tomas', place: { no: '3. på smak, 6. offisielt (11 øl)', en: '3rd on taste, 6th officially (11 beers)', ja: '味で3位、公式6位（11本中）' } },
        { year: 2022, by: 'Eirik', place: { no: '9. på smak, 10. og sist offisielt (10 øl)', en: '9th on taste, 10th and last officially (10 beers)', ja: '味で9位、公式10位＝最下位（10本中）' } },
      ],
      summary: {
        no: 'Har vært med to ganger – og gått fra toppen (3. på smak i 2021) til sist (2022). Tredje gang god?',
        en: 'In twice already – and went from the top (3rd on taste in 2021) to last (2022). Third time lucky?',
        ja: 'すでに2回出場 – 上位（2021年は味で3位）から最下位（2022年）へ。三度目の正直？',
      },
      pick: {
        no: [
          'Historikk: Père Noël! 3. på smak da Tomas stilte den i 2021 – SIST da Eirik stilte den i 2022. Tredje gang god for {name}?!',
          'Père Noël er tilbake for tredje gang! Fra toppen til bunnen på ett år – hvor lander den i kveld?!',
        ],
        en: [
          'History: Père Noël! 3rd on taste when Tomas brought it in 2021 – LAST when Eirik brought it in 2022. Third time lucky for {name}?!',
          'Père Noël is back for a third time! From the top to the bottom in one year – where will it land tonight?!',
        ],
        ja: [
          '歴史：ペール・ノエル！2021年トーマスの時は味で3位 – 2022年エイリクの時は最下位。{name}で三度目の正直なるか？！',
          'ペール・ノエルが3度目の登場！1年でトップから最下位へ – 今夜はどこに着地する？！',
        ],
      },
    },
  },
  {
    match: (n) => n.includes('bernardus') || n.includes('bernadousis'),
    h: {
      title: 'St. Bernardus Christmas Ale',
      rows: [
        { year: 2020, by: 'Hans Magnus', place: { no: 'Vant!', en: 'Won!', ja: '優勝！' } },
        { year: 2022, by: 'Kathinka', place: { no: '7. på smak, 9. offisielt (10 øl) – som «Sgt. Bernadousis»', en: '7th on taste, 9th officially (10 beers) – as «Sgt. Bernadousis»', ja: '味で7位、公式9位（10本中）–「Sgt. Bernadousis」として' } },
      ],
      summary: {
        no: 'Vant det aller første året, i 2020 (Hans Magnus). Da Kathinka stilte den i 2022 – som «Sgt. Bernadousis» – ble det 9. plass. Nå prøver hun igjen!',
        en: 'Won the very first year, 2020 (Hans Magnus). When Kathinka brought it in 2022 – as «Sgt. Bernadousis» – it came 9th. Now she tries again!',
        ja: '第1回の2020年に優勝（ハンス・マグヌス）。2022年にカティンカが「Sgt. Bernadousis」として持ってきた時は9位。再挑戦！',
      },
      pick: {
        no: [
          'Historikk: St. Bernardus vant aller første Gulmasse i 2020 – stilt av Hans Magnus! Men som «Sgt. Bernadousis» i 2022 ble det 9. plass. Får {name} den tilbake på tronen?!',
          'St. Bernardus – vinnerølet fra 2020! Hans Magnus er ikke her i år, men ølet hans er. Kan det skje igjen?!',
        ],
        en: [
          'History: St. Bernardus won the very first Gulmasse in 2020 – brought by Hans Magnus! But as «Sgt. Bernadousis» in 2022 it came 9th. Can {name} put it back on the throne?!',
          'St. Bernardus – the 2020 winner! Hans Magnus isn\'t here this year, but his beer is. Can it happen again?!',
        ],
        ja: [
          '歴史：セント・ベルナルデュスは2020年の第1回Gulmasseで優勝 – ハンス・マグヌスが持参！でも2022年「Sgt. Bernadousis」としては9位。{name}は王座に戻せるか？！',
          'セント・ベルナルデュス – 2020年の優勝ビール！ハンス・マグヌスは今年いないけど、彼のビールはここに。再び奇跡は起きるか？！',
        ],
      },
    },
  },
  {
    match: (n) => n.includes('tomasmesse'),
    h: {
      title: 'Tomasmesse (Kinn)',
      rows: [{ year: 2025, by: 'Roald', place: { no: '3. plass av 6, offisielt', en: '3rd of 6, officially', ja: '公式6本中3位' } }],
      summary: {
        no: 'Med én gang før: 3. plass av 6 i fjor, stilt av Roald. Klarer den å klatre helt til topps?',
        en: 'In once before: 3rd of 6 last year, brought by Roald. Can it climb all the way to the top?',
        ja: '昨年1回出場：ロアルドが持参し6本中3位。今年は頂点まで登れるか？',
      },
      pick: {
        no: ['Historikk: Tomasmesse fra Kinn tok 3. plass av 6 i fjor, stilt av Roald. Nå er det {name} sin tur – blir det pall igjen?!'],
        en: ['History: Tomasmesse from Kinn took 3rd of 6 last year, brought by Roald. Now it\'s {name}\'s turn – podium again?!'],
        ja: ['歴史：キン醸造所のトーマスメッセは昨年6本中3位（ロアルド持参）。今度は{name}の番 – また表彰台か？！'],
      },
    },
  },
];

export function getBeerHistory(beerName: string): BeerHistory | null {
  const n = norm(beerName);
  if (!n) return null;
  return HISTORY.find((x) => x.match(n))?.h ?? null;
}
