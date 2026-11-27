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
    ],
    facts: ['6. året i konkurransen', 'Aldri vunnet', 'Gir alltid eget øl 6 poeng'],
  },
  kathinka: {
    emoji: '🧦',
    tagline: 'Vinneren fra 2021',
    bio: [
      'Vant i 2021 med Delirium Christmas – da ble det dansing og sokkeskli!',
      'I år stiller hun St. Bernardus – ølet som vant det aller første året konkurransen gikk av stabelen, i 2020. Men da hun stilte samme øl i 2022, ble det 9. plass, nest sist. Vinnerøl eller nedtur – hvilken versjon får vi i år?',
    ],
    facts: ['Vinner 2021 (Delirium Christmas)', 'St. Bernardus vant i 2020', 'Samme øl i 2022: 9. plass, nest sist'],
  },
  claus: {
    emoji: '🦊',
    tagline: 'Ringreven',
    bio: [
      'Han er blitt en ringrev nå, Claus – men har aldri nådd helt opp på toppen av podiet.',
      'I år stiller han Delirium Christmas. Delirium har vunnet før, i 2021, men et par år etter kom den til kort. Revansj i år?',
    ],
    facts: ['Aldri på toppen av podiet', 'Delirium Christmas vant i 2021'],
  },
  carlpetter: {
    emoji: '🥕',
    tagline: 'Ny i gamet',
    bio: [
      'Ny i år! Skallamann nr. 4 – etter Tomas, Adam og Magnus.',
      'Vegetarianer – vi vet ikke hvordan det slår ut på stemmene. Og passer ølsmaken hans om han ikke har ganen full av ribbefett??',
      'Han stiller Père Noël – samme øl som Eirik stilte i 2022.',
    ],
    facts: ['Debutant', 'Skallamann nr. 4', 'Vegetarianer', 'Père Noël – stilt av Eirik i 2022'],
  },
  eirik: {
    emoji: '☢️',
    tagline: 'NukeBrew-bryggeren',
    bio: [
      'Kjent for å falle for eget sverd.',
      'I år stiller han en egenkomponert ICBM fra sitt eget bryggeri NukeBrew. I dråpene skal det visstnok være «the essence of pure flavor»..',
      'I 2022 stilte han Père Noël.',
    ],
    facts: ['Eget bryggeri: NukeBrew', 'Faller gjerne for eget sverd', 'Stilte Père Noël i 2022'],
  },
  magnus: {
    emoji: '🃏',
    tagline: 'Ungfolan',
    bio: [
      'Ungfolan Magnus! Vil GenZ noen gang klare å like øl? Vet de hva øl er? Og vet de hvordan den eldre garde av millennials stemmer??',
      'Her er det mye usikkerhet – men han er en god joker, det skal Magnus ha.',
    ],
    facts: ['GenZ', 'Kveldens joker'],
  },
  adam: {
    emoji: '🇯🇵',
    tagline: 'Adam-san',
    bio: [
      'Halvt japansk, halvt manchesterianer, og helt juleølboss!',
      'Om ikke Adam får 6 på presentasjonen, så er feltet helt åpent!',
    ],
    facts: ['Halvt japansk, halvt Manchester', 'Juleølboss', 'Presentasjonsfavoritt'],
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
    tagline: 'Nykommer',
    bio: ['Ny i år – venninne av Kathinka. Vi vet lite om henne ennå, så hun er et helt ukjent kort i stokken!'],
    facts: ['Debutant', 'Venninne av Kathinka'],
  },
  aurora: {
    emoji: '🌌',
    tagline: 'Nykommer',
    bio: ['Ny i år – venninne av Kathinka. Vi vet lite om henne ennå, så hun er et helt ukjent kort i stokken!'],
    facts: ['Debutant', 'Venninne av Kathinka'],
  },
};

export function getProfile(name: string): Profile | null {
  return PROFILES[profileKey(name)] ?? null;
}
