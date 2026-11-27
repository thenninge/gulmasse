/**
 * The Live Leaderboard's over-excited sports commentator.
 * Facts about participants come from the host; nothing here is invented.
 * Each event has several variants, picked deterministically from the event id
 * so a line doesn't change when the page re-renders.
 */
import type { Lang } from '@/lib/leaderboardI18n';

export type CommentKind = 'pick' | 'leader' | 'beer6' | 'pres6' | 'double6' | 'beer1' | 'presLow' | 'allVoted';
export type CommentParams = { name?: string; beer?: string; avg?: number | null };

type Lines = Partial<Record<CommentKind, string[]>>;

/** Normalised first-name key: «Carl Petter» → carlpetter, «Trond-Olav» → trondolav */
const keyOf = (name: string) => (name || '').toLowerCase().replace(/[^a-zæøå]/g, '');

// ── Norwegian ────────────────────────────────────────────────────────────────
const NO_PEOPLE: Record<string, Lines> = {
  martin: {
    pick: [
      'Hjulet valgte Martin – {beer}! Han vant jo i fjor! DETTE BLIR SPENNENDE!',
      'Martin på banen med {beer}! Ølhund, legende, globetrotter – og regjerende mester! Klarer han å tangere Konrad?!',
    ],
    leader: [
      'Martin tar ledelsen! Fjorårsvinneren viser klørne – blir trofeet hos Martin ett år til?!',
      'Martin i tet! To deltakelser, én seier – og nå lukter det dobbel! Konrad, se deg over skulderen!',
    ],
  },
  claus: {
    pick: [
      'Hjulet valgte Claus – {beer}. Delirium har vunnet før, i 2021, men et par år etter kom den til kort. Revansj i kveld?!',
      'Claus med {beer}! Ringreven er klar – men toppen av podiet har han aldri nådd. Er det I ÅR det skjer?!',
    ],
    leader: [
      'Claus tar ledelsen! Han er jo blitt en ringrev nå, Claus, men aldri nådd helt opp på toppen av podiet. Er det i kveld?!',
    ],
  },
  carlpetter: {
    pick: [
      'Hjulet valgte Carl Petter – {beer}. Carl Petter altså.. ny i gamet i år. Vil det trekke ned at han er vegetarianer..? Spenningen er til å ta og føle på!',
      'Carl Petter med {beer}! Skallamann nr. 4 – etter Tomas, Adam og Magnus! Holder ganen uten ribbefett mål?!',
    ],
    leader: [
      'Carl Petter tar ledelsen. Jøjje meg! Han er i tet, dere! En vegetarianer i tet!',
      'Skallamann nr. 4 i tet!! Carl Petter tar ledelsen – og det uten en eneste ribbebit!',
    ],
  },
  nora: {
    pick: ['Hjulet valgte Nora – {beer}! På med hatten til Nora! Ut i dyst!', 'Nykommer Nora med {beer}! Kathinkas venninne – et helt ukjent kort i stokken!'],
    leader: ['Nora tar ledelsen! Nykommeren i tet – hvem hadde sett DEN komme?!'],
  },
  aurora: {
    pick: ['Hjulet valgte Aurora – {beer}! Ny i år, venninne av Kathinka – ingen vet hva vi har i vente!', 'Aurora med {beer}! På med hatten! Ut i dyst!'],
    leader: ['Aurora tar ledelsen! Nykommeren gir veteranene kamp til døra!'],
  },
  eirik: {
    pick: [
      'Hjulet valgte Eirik – {beer}! Rett fra hans eget bryggeri NukeBrew – «the essence of pure flavor»! Eller faller han for eget sverd igjen?',
      'NukeBrew på scenen! Eirik med {beer} – egenkomponert og fryktløs!',
    ],
    leader: ['Eirik tar ledelsen! NukeBrew i tet – nå gjelder det bare å ikke falle for eget sverd!'],
    beer1: ['Au! En ener på {beer}.. Falt Eirik for eget sverd igjen?!'],
  },
  tomas: {
    pick: [
      'Hjulet valgte Tomas – {beer}! Verten og oppfinneren selv! 6. året nå. Aldri vunnet. En evig taper? Vi får se..',
      'Vertskapet på banen! Tomas med {beer} – er det NÅ det endelig skjer?!',
    ],
    leader: ['Tomas tar ledelsen!! Verten i tet! 6 år uten seier – er forbannelsen brutt?!'],
  },
  kathinka: {
    pick: [
      'Hjulet valgte Kathinka – {beer}! Vinneren fra 2021 – da ble det dansing og sokkeskli! Gjør klar sokkene!',
      'Kathinka med {beer}! St. Bernardus vant det aller første året, i 2020 – kan hun ta tilbake tronen?!',
    ],
    leader: ['Kathinka tar ledelsen! Sokkeskli-alarm! 2021-vinneren er tilbake i tet!'],
  },
  magnus: {
    pick: [
      'Hjulet valgte Magnus – {beer}! Ungfolan Magnus! Vil GenZ noen gang klare å like øl? Vet de i det hele tatt hva øl er?!',
      'Magnus med {beer}! Jokeren er trukket – og hvordan stemmer egentlig den eldre garde av millennials?!',
    ],
    leader: ['Magnus tar ledelsen! GenZ i tet! Millennials klør seg i hodet!'],
  },
  adam: {
    pick: [
      'Hjulet valgte Adam – {beer}! Adam-san! Halvt japansk, halvt Manchester, og helt juleølboss!',
      'Adam-san med {beer}! Får ikke Adam 6 på presentasjonen, er feltet helt åpent!',
    ],
    leader: ['Adam-san tar ledelsen! Juleølbossen viser hvem som bestemmer!'],
    pres6: ['Sekser på presentasjonen til Adam-san! Som forventet fra juleølbossen!'],
    presLow: ['Hæ?! Lav presentasjonskarakter til Adam-san?! Da er feltet HELT åpent!'],
  },
  trondolav: {
    pick: [
      'Hjulet valgte Trond-Olav! Naboen som ingen vet om dukker opp – men alltid dukker opp likevel! Hvor har han vært i dag? Portugal? Sardinia? Helsinki?',
      'Naboen Trond-Olav på scenen! Har han i det hele tatt valgt øl? Det vet ingen!',
    ],
    leader: ['Trond-Olav tar ledelsen! Naboen dukker opp fra intet – som vanlig!'],
  },
};

const NO_GENERIC: Record<CommentKind, string[]> = {
  pick: ['Hjulet valgte {name} – {beer}! På med hatten! Ut i dyst!', '{name} er valgt! {beer} skal i ilden – spenningen stiger!'],
  leader: ['{name} tar ledelsen! Nå koker det i salen!', '{name} i tet! Hold dere fast!'],
  beer6: [
    'Sekser på ølen til {name}..!! Saft suse! 6-er på {beer}! Nå kan alt skje!',
    'SEKSER! {beer} treffer blink! {name} jubler!',
  ],
  pres6: ['Sekser på presentasjonen til {name}! Stående applaus i salen!', 'Full pott for showet! {name} leverer en 6-er-presentasjon!'],
  double6: ['DOBBEL SEKSER til {name}! Øl OG presentasjon! Dette er historisk, folkens!'],
  beer1: ['Au! En ener på {beer}.. noen i salen er IKKE imponert!'],
  presLow: ['Mjaa.. litt trekk for presentasjonen til {name}.. vil det stå seg til slutt??'],
  allVoted: ['Alle har stemt på {beer}! Snitt {avg}. {verdict}'],
};

const NO_VERDICT = (avg: number) =>
  avg >= 5 ? 'Dette er TOPP-klasse, folkens!' : avg >= 4 ? 'Sterkt levert!' : avg >= 3 ? 'Solid midt på treet.' : 'Tungt. Veldig tungt.';

// ── English ──────────────────────────────────────────────────────────────────
const EN_PEOPLE: Record<string, Lines> = {
  martin: {
    pick: ["The wheel picks Martin – {beer}! Last year's champion! THIS IS GOING TO BE TENSE!"],
    leader: ['Martin takes the lead! Can the defending champion keep the trophy?!'],
  },
  claus: {
    pick: ['The wheel picks Claus – {beer}. Delirium won back in 2021, then fell short a few years later. Revenge tonight?!'],
    leader: ['Claus takes the lead! A seasoned veteran who has never quite reached the top of the podium. Is tonight the night?!'],
  },
  carlpetter: {
    pick: ['The wheel picks Carl Petter – {beer}. New to the game this year – will being a vegetarian hold him back..? The tension is unbearable!'],
    leader: ['Carl Petter takes the lead. Good heavens! A vegetarian in front!'],
  },
  nora: { pick: ['The wheel picks Nora – {beer}! Hat on, Nora! Into battle!'], leader: ['Nora takes the lead! The newcomer is in front – who saw THAT coming?!'] },
  aurora: { pick: ['The wheel picks Aurora – {beer}! A newcomer – nobody knows what to expect!'], leader: ['Aurora takes the lead! The newcomer is giving the veterans a run for their money!'] },
  eirik: {
    pick: ['The wheel picks Eirik – {beer}! Straight from his own NukeBrew brewery – «the essence of pure flavor»! Or will he fall on his own sword again?'],
    leader: ['Eirik takes the lead! NukeBrew in front – just don\'t fall on your own sword now!'],
  },
  tomas: {
    pick: ['The wheel picks Tomas – {beer}! The host and inventor himself! 6th year, never won. Eternal loser? We\'ll see..'],
    leader: ['Tomas takes the lead!! The host in front! Is the curse finally broken?!'],
  },
  kathinka: {
    pick: ['The wheel picks Kathinka – {beer}! The 2021 winner – there was dancing and sock-sliding! Get your socks ready!'],
    leader: ['Kathinka takes the lead! Sock-slide alert! The 2021 champion is back in front!'],
  },
  magnus: {
    pick: ['The wheel picks Magnus – {beer}! Young Magnus! Will Gen Z ever learn to like beer?!'],
    leader: ['Magnus takes the lead! Gen Z in front! The millennials are scratching their heads!'],
  },
  adam: {
    pick: ['The wheel picks Adam – {beer}! Adam-san! Half Japanese, half Mancunian, all Christmas-beer boss!'],
    leader: ['Adam-san takes the lead! The Christmas-beer boss shows who\'s in charge!'],
  },
  trondolav: {
    pick: ['The wheel picks Trond-Olav! The neighbour nobody knows will turn up – but always does! Portugal? Sardinia? Helsinki? Nobody knows!'],
    leader: ['Trond-Olav takes the lead! The neighbour appears out of nowhere – as usual!'],
  },
};

const EN_GENERIC: Record<CommentKind, string[]> = {
  pick: ['The wheel picks {name} – {beer}! Hat on! Into battle!'],
  leader: ['{name} takes the lead! The room is on fire!'],
  beer6: ['A SIX for {name}\'s beer..!! Wow! A 6 for {beer}! Anything can happen now!'],
  pres6: ['A six for {name}\'s presentation! Standing ovation!'],
  double6: ['DOUBLE SIX for {name}! Beer AND presentation! This is historic, folks!'],
  beer1: ['Ouch! A one for {beer}.. someone in the room is NOT impressed!'],
  presLow: ['Meh.. a low score for {name}\'s presentation.. will it hold up in the end??'],
  allVoted: ['Everyone has voted on {beer}! Average {avg}. {verdict}'],
};

const EN_VERDICT = (avg: number) =>
  avg >= 5 ? 'This is TOP class, folks!' : avg >= 4 ? 'Strong showing!' : avg >= 3 ? 'Solidly mid-table.' : 'Tough. Very tough.';

/** Returns a commentator line, or null when this language has no commentator (fallback to plain text). */
export function commentary(
  lang: Lang,
  kind: CommentKind,
  p: CommentParams,
  seed: number,
  formatAvg: (n: number | null | undefined) => string,
): string | null {
  if (lang !== 'no' && lang !== 'en') return null;
  const people = lang === 'no' ? NO_PEOPLE : EN_PEOPLE;
  const generic = lang === 'no' ? NO_GENERIC : EN_GENERIC;
  const verdict = lang === 'no' ? NO_VERDICT : EN_VERDICT;
  const personal = people[keyOf(p.name || '')]?.[kind];
  const pool = personal && personal.length ? personal : generic[kind];
  const line = pool[Math.abs(seed) % pool.length];
  const beer = (p.beer || '').trim() || (lang === 'no' ? 'ølen' : 'the beer');
  return line
    .replace(/\{name\}/g, p.name || '')
    .replace(/\{beer\}/g, beer)
    .replace(/\{avg\}/g, formatAvg(p.avg ?? null))
    .replace(/\{verdict\}/g, p.avg != null ? verdict(p.avg) : '')
    .replace(/ – !/g, '!')
    .trim();
}
