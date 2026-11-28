/**
 * Participant profiles for the lobby info page. Same facts as the leaderboard
 * commentator – all provided by the host; nothing invented.
 */
export type Profile = {
  emoji: string;
  tagline: string;
  bio: string[];
  /** short «Fra arkivet» facts */
  facts: string[];
};

/** Same key as the commentator: «Carl Petter» → carlpetter, «Trond-Olav» → trondolav */
export const profileKey = (name: string) => (name || '').toLowerCase().replace(/[^a-zæøå]/g, '');

const PROFILES: Record<string, Profile> = {
  tomas: {
    emoji: '🎩',
    tagline: 'Vertskap og oppfinner',
    bio: [
      'Mannen bak Gulmasse – vertskap og oppfinner. 6. året nå. Aldri vunnet. En evig taper? Vi får se..',
      'Historisk sett gir Tomas alltid sitt eget øl en sekser. Sneaky – men helt innenfor regelboka!',
      'I 2021 stilte han Père Noël: 3. på smak, men bare 6. offisielt.',
      'Årets øl, TTTDOP, er – helt seriøst – kjøpt i Kyiv og smuglet forbi både polske og moldovske grensevakter! Det må jo gi uttelling på presentasjonen?',
    ],
    facts: ['6. året i konkurransen', 'Aldri vunnet', 'Gir alltid eget øl 6 poeng', 'Øl kjøpt i Kyiv', 'Smuglet forbi to grenser'],
  },
  kathinka: {
    emoji: '🧦',
    tagline: 'Vinneren fra 2021',
    bio: [
      'Vant i 2021 med Delirium Christmas – da ble det dansing og sokkeskli!',
      'I år stiller hun St. Bernardus – ølet som vant det aller første året, i 2020, stilt av Hans Magnus. Men da hun selv stilte den i 2022 – som «Sgt. Bernadousis» – ble det 7. på smak og 9. offisielt, nest sist. Vinnerøl eller nedtur – hvilken versjon får vi i år?',
    ],
    facts: ['Vinner 2021 (Delirium Christmas)', 'St. Bernardus vant i 2020', '«Sgt. Bernadousis» 2022: 9. plass'],
  },
  claus: {
    emoji: '🦊',
    tagline: 'Ringreven',
    bio: [
      'Han er blitt en ringrev nå, Claus – men har aldri nådd helt opp på toppen av podiet.',
      'I år stiller han Delirium Christmas – vinnerølet fra 2021 (Kathinka). Men da Adam stilte den i 2022, ble det bare 5. plass. Revansj i år?',
    ],
    facts: ['Aldri på toppen av podiet', 'Delirium Christmas: 1. i 2021, 5. i 2022'],
  },
  carlpetter: {
    emoji: '🥕',
    tagline: 'Ny i gamet',
    bio: [
      'Ny i år! Skallamann nr. 4 – etter Tomas, Adam og Magnus.',
      'Vegetarianer – vi vet ikke hvordan det slår ut på stemmene. Og passer ølsmaken hans om han ikke har ganen full av ribbefett??',
      'Han har jobbet som snømåker i Oslo – med traktor og full pakke! Og etter endt vakt pleide han å spise kebab. En vegetarianer og kebab? Her står spørsmålene i kø..',
      'Han stiller Père Noël – et øl med historie: 3. på smak da Tomas stilte den i 2021, men sist da Eirik stilte den i 2022. Tredje gang god?',
    ],
    facts: ['Debutant', 'Skallamann nr. 4', 'Vegetarianer', 'Snømåker i Oslo (traktor!)', 'Kebab etter vakta', 'Père Noël: 3. på smak 2021, sist 2022'],
  },
  eirik: {
    emoji: '☢️',
    tagline: 'NukeBrew-bryggeren',
    bio: [
      'Kjent for å falle for eget sverd.',
      'I år stiller han en egenkomponert ICBM fra sitt eget bryggeri NukeBrew. I dråpene skal det visstnok være «the essence of pure flavor»..',
      'I 2022 stilte han Père Noël – den ble 10. og sist offisielt. Nå satser han på egenbrygg i stedet!',
    ],
    facts: ['Eget bryggeri: NukeBrew', 'Faller gjerne for eget sverd', 'Père Noël 2022: sist'],
  },
  magnus: {
    emoji: '🃏',
    tagline: 'Ungfolan',
    bio: [
      'Ungfolan Magnus! Vil GenZ noen gang klare å like øl? Vet de hva øl er? Og vet de hvordan den eldre garde av millennials stemmer??',
      'Her er det mye usikkerhet – men han er en god joker, det skal Magnus ha.',
      'Men ikke la deg lure av ungfole-stempelet: Magnus er både gründer og veteran! Ung av år, gammel i gamet.',
      'Og så er han fra Rjukan! Byen der sola ikke når ned i dalen om vinteren – de måtte bokstavelig talt henge opp speil på fjellet for å få litt lys på torget. Mørkt øl skremmer altså ikke Magnus.',
      'Rjukan er også hjemmet til tungtvannet på Vemork. Så spørsmålet er: tåler han tunge øl like godt som Rjukan tålte tungtvannet? Og blir det sabotasje i kveld?',
    ],
    facts: ['GenZ', 'Gründer', 'Veteran', 'Kveldens joker', 'Fra Rjukan', 'Vant til mørket', 'Tungtvann-ekspert?'],
  },
  adam: {
    emoji: '🇯🇵',
    tagline: 'Adam-san',
    bio: [
      'Helt engelsk – men han var i Japan i april, og Adam-san passer ham perfekt. Og helt juleølboss!',
      'Om ikke Adam får 6 på presentasjonen, så er feltet helt åpent!',
      'I 2022 stilte han Delirium Christmas – fjorårsvinneren den gang – og fikk 5. plass.',
      'Oppladningen i år: Adam har prøvesmakt 9 juleøl bare denne uken! Godt trent – men klarer han å levere innlevelse i år?',
    ],
    facts: ['Helt engelsk', 'Japan i april', 'Juleølboss', 'Presentasjonsfavoritt', 'Delirium 2022: 5. plass', '9 juleøl smakt denne uken'],
  },
  martin: {
    emoji: '🏆',
    tagline: 'Regjerende mester',
    bio: [
      'Ølhund, legende, globetrotter. Stiller sent, men godt. Det er mulig han prøver å snike inn flere øl på si – ingen som vet.',
      'Alle vet bare at Martin har vært med 2 ganger og tok hjem seieren i fjor! Klarer han å ta trofeet i år også – og dermed tangere antallet seiere med Konrad?',
    ],
    facts: ['Vinner i fjor', 'Med for 2. gang', 'Kan tangere Konrad'],
  },
  trondolav: {
    emoji: '✈️',
    tagline: 'Naboen',
    bio: [
      'Naboen Trond-Olav! Han som ingen vet om dukker opp – men alltid dukker opp likevel.',
      'Hvor har han vært før i dag? Portugal? Sardinia? Helsinki? Ingen som vet. Alle vet bare at han ikke har valgt øl ennå.',
    ],
    facts: ['Dukker alltid opp', 'Ukjent oppholdssted', 'Har ikke valgt øl ennå'],
  },
  nora: {
    emoji: '✨',
    tagline: 'Nora – ikke Noora!',
    bio: [
      'Nora. Ikke Noora! Ikke «jeg trenger litt spæis!»-Nooorra. Ikke Skam-Nooora som klina med William!',
      'Dette er nemlig en mye bedre utgave: Nora. Konsis. Skarp. Nybegynnerflaksen er til å ta og føle på!',
      'Ny i år – venninne av Kathinka. Og her har vi gravd i arkivene: Nora er nevnt i en eldre artikkel i Tønsbergs Blad, i forbindelse med russerevy. Scenevant, med andre ord – det kan bli farlig på presentasjonen!',
      'I oktober 2026 fikk hun en velkomsthilsen fra Top Himalaya guides, på fottur i Manaslu-regionen i Nepal. Hun har altså gått i Himalaya – da er vel en juleølkonkurranse en lett tur i parken?',
      'Og så har hun selv uttalt at hun får sine beste ideer på polet. Da må vel årets øl være en av dem?',
    ],
    facts: ['Debutant', 'Ikke Noora', 'Konsis og skarp', 'Russerevy (Tønsbergs Blad)', 'Manaslu, Nepal 2026', 'Beste ideer: på polet', 'Venninne av Kathinka'],
  },
  aurora: {
    emoji: '🎤',
    tagline: 'Sangstemmen',
    bio: [
      'Ny i år – venninne av Kathinka.',
      'Steinerskolen, så Berkeley. Eller var det Berklee? Ingen vet helt sikkert – universitetet i California eller musikkskolen i Boston? Sangstemmen peker mot Berklee, men det er presentasjonen som avgjør: blir det en akademisk avhandling eller en ballade?',
      'Én ting er sikkert: flott sangstemme! Blir det sang på presentasjonen, kan presentasjonsterningen trille rett på seksern!',
      'Og hold dere fast: Aurora har danset med Michael Jackson på Valle Hovin! Blir det moonwalk på presentasjonen?',
      'Og ølvalget? TOMASmesse. På en konkurranse der verten heter … Tomas. Smisk? Bestikkelse? Et forsøk på å kjøpe seg en sekser fra verten? Juryen noterer seg dette!',
    ],
    facts: ['Debutant', 'Steinerskolen', 'Berkeley? Berklee?', 'Flott sangstemme', 'Danset med Michael Jackson', 'Stiller TOMASmesse (!)', 'Venninne av Kathinka'],
  },
};

export function getProfile(name: string): Profile | null {
  return PROFILES[profileKey(name)] ?? null;
}
