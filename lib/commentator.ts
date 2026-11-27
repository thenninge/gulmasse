/**
 * The Live Leaderboard's over-excited sports commentator.
 * Facts about participants come from the host; nothing here is invented.
 * Each event has several variants, picked deterministically from the event id
 * so a line doesn't change when the page re-renders.
 */
import type { Lang } from '@/lib/leaderboardI18n';
import { getBeerHistory } from '@/lib/beerHistory';

export type CommentKind =
  | 'pick' | 'leader'
  | 'double6' | 'beer6' | 'beer5' | 'beer2' | 'beer1' | 'pres6' | 'pres5' | 'presLow' | 'pres1'
  | 'halfway' | 'allVoted' | 'recordHigh' | 'recordLow' | 'climb' | 'fall'
  | 'standingClose' | 'standingBig' | 'standing' | 'selfSix' | 'award' | 'awardCta'
  /** «we miss the veterans» filler: quiet moments, a stumble, a strong result */
  | 'missIdle' | 'missStumble' | 'missStrong'
  /** the beer has been in Gulmasse before – its story (from lib/beerHistory) */
  | 'beerHistory';
export type CommentParams = {
  name?: string; beer?: string; avg?: number | null;
  /** places for climb/fall, points margin + runner-up for standings */
  from?: number; to?: number; margin?: number; second?: string; vet?: string;
};

type Lines = Partial<Record<CommentKind, string[]>>;

/** Normalised first-name key: «Carl Petter» → carlpetter, «Trond-Olav» → trondolav */
/** Veterans who aren't on the list this year – the commentator misses them */
export const MISSING_VETERANS = ['Konrad', 'Andreas', 'Johan', 'Hans Magnus'];

/** Which veteran a filler line misses – decorrelated from the line choice, so all combinations show up */
export const vetFor = (seed: number) => MISSING_VETERANS[Math.abs(Math.imul(seed, 2654435761) >> 7) % MISSING_VETERANS.length];

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
      'Hjulet valgte Claus – {beer}. Delirium vant i 2021, men ble bare nr. 5 da Adam stilte den i 2022. Revansj i kveld?!',
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
      'Carl Petter med {beer}! Han har måkt snø i Oslo med traktor og full pakke – nå skal han rydde vei til toppen!',
      'Carl Petter med {beer}! Snømåker med traktor, og kebab etter endt vakt. Vegetarianer altså.. Her er det mye vi ikke forstår!',
      'Carl Petter med {beer}! Kjenner vi den igjen? JA – Eirik stilte med Père Noël i 2022! Gjør den det bedre i nye hender?!',
    ],
    leader: [
      'Carl Petter tar ledelsen. Jøjje meg! Han er i tet, dere! En vegetarianer i tet!',
      'Skallamann nr. 4 i tet!! Carl Petter tar ledelsen – og det uten en eneste ribbebit!',
      'Carl Petter brøyter seg forbi alle! Snømåkeren med traktor har tatt ledelsen – det blir kebab i kveld!',
    ],
  },
  nora: {
    pick: [
      'Hjulet valgte Nora – {beer}! Ikke Noora! Ikke «jeg trenger litt spæis!»-Nooorra. Ikke Skam-Nooora som klina med William! Dette er nemlig en mye bedre utgave: Nora!',
      'Nora med {beer}! Konsis. Skarp. Nybegynnerflaksen er til å ta og føle på!',
      'Nykommer Nora med {beer}! På med hatten! Og husk: det er NORA, ikke Noora!',
      'Nora med {beer}! Scenevant fra russerevyen – det sto i Tønsbergs Blad! Nå venter en ny scene!',
      'Nora med {beer}! Hun har gått i Manaslu-regionen i Nepal – en øl-presentasjon er vel ingen sak etter Himalaya?!',
      'Nora med {beer}! Hun får jo sine beste ideer på polet – var {beer} en av dem?!',
    ],
    leader: ['Nora tar ledelsen! Nybegynnerflaksen slår til – konsis, skarp og i tet!', 'Nora i tet! Ikke Noora – NORA! Den mye bedre utgaven!', 'Nora tar ledelsen! Beste ideer på polet – og det lønner seg, folkens!'],
  },
  aurora: {
    pick: [
      'Hjulet valgte Aurora – {beer}! Steinerskolen, Berkeley og en flott sangstemme – blir det SANG på presentasjonen?!',
      'Aurora med {beer}! På med hatten! Ny i år, venninne av Kathinka – ingen vet hva vi har i vente!',
      'Aurora med {beer}! Hun har danset med Michael Jackson på Valle Hovin – blir det moonwalk på presentasjonen?!',
    ],
    leader: ['Aurora tar ledelsen! Nykommeren gir veteranene kamp til døra!', 'Aurora i tet! Nå synger hun seg til topps!', 'Aurora tar ledelsen! Hun har danset med Michael Jackson – nå moonwalker hun forbi hele feltet!'],
    pres6: ['Sekser på presentasjonen til Aurora! Den sangstemmen gjør susen!'],
  },
  eirik: {
    pick: [
      'Hjulet valgte Eirik – {beer}! Rett fra hans eget bryggeri NukeBrew – «the essence of pure flavor»! Eller faller han for eget sverd igjen?',
      'NukeBrew på scenen! Eirik med {beer} – egenkomponert og fryktløs!',
      'Eirik med {beer}! I 2022 stilte han Père Noël – i år brygger han selv. Modig. Eller dumdristig?!',
    ],
    leader: ['Eirik tar ledelsen! NukeBrew i tet – nå gjelder det bare å ikke falle for eget sverd!'],
    beer1: ['Au! En ener på {beer}.. Falt Eirik for eget sverd igjen?!'],
  },
  tomas: {
    pick: [
      'Hjulet valgte Tomas – {beer}! Verten og oppfinneren selv! 6. året nå. Aldri vunnet. En evig taper? Vi får se..',
      'Vertskapet på banen! Tomas med {beer} – er det NÅ det endelig skjer?!',
      'Tomas med {beer}! Helt seriøst kjøpt i Kyiv – og smuglet forbi både polske OG moldovske grensevakter! Hvis ikke DET gir sekser på presentasjonen, hva gjør da?!',
    ],
    leader: ['Tomas tar ledelsen!! Verten i tet! 6 år uten seier – er forbannelsen brutt?!'],
    selfSix: ['Aiai! 6-er til Tomas – FRA Tomas! Like sneaky i år som foregående år.. men det er lov ihht regelboka!'],
  },
  kathinka: {
    pick: [
      'Hjulet valgte Kathinka – {beer}! Vinneren fra 2021 – da ble det dansing og sokkeskli! Gjør klar sokkene!',
      'Kathinka med {beer}! St. Bernardus vant det aller første året, i 2020 – kan hun ta tilbake tronen?!',
      'Kathinka med {beer} – samme øl som hun stilte i 2022! Da ble det 9. plass, nest sist.. REVANSJ eller ny nedtur?!',
      'Kathinka og {beer}! Vinnerøl i 2020, nest sist i 2022 – hvilken versjon får vi i kveld?! Spenningen er ULIDELIG!',
    ],
    leader: [
      'Kathinka tar ledelsen! Sokkeskli-alarm! 2021-vinneren er tilbake i tet!',
      'Kathinka i tet! Nest sist med samme øl i 2022 – nå på toppen! For en snuoperasjon!',
    ],
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
      'Hjulet valgte Adam – {beer}! Adam-san! Helt engelsk – men han var i Japan i april, og Adam-san passer ham perfekt! Og helt juleølboss!',
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
  beer5: ['Femmer på {beer}! Det lukter pallplass, folkens!', 'Sterk femmer til {name}! {beer} leverer!'],
  beer2: ['Toer på {beer}.. Det var ikke dét {name} håpet på..', 'Uff, en toer. {beer} sliter i motbakken!'],
  beer1: ['Au! En ener på {beer}.. noen i salen er IKKE imponert!', 'ENER! Det gjorde vondt å se. {beer} får juling!'],
  pres5: ['Femmer på presentasjonen! {name} har salen i sin hule hånd!', 'Pitchen sitter! Femmer på showet til {name}!'],
  presLow: ['Mjaa.. litt trekk for presentasjonen til {name}.. vil det stå seg til slutt??'],
  pres1: ['Ener på presentasjonen?! Noen sovnet visst under talen til {name}..', 'AU! Ener på showet. {name} må jobbe med retorikken!'],
  halfway: ['Halvveis! Halvparten har stemt på {beer} – snittet ligger på {avg} så langt!', 'Pause i dysten? Neida! Halve salen har stemt – {avg} i snitt foreløpig!'],
  allVoted: ['Alle har stemt på {beer}! Snitt {avg}. {verdict}'],
  recordHigh: ['NY REKORD! {beer} får kveldens høyeste snitt så langt: {avg}!', 'Historisk! {name} setter kveldsrekord med {avg} i snitt!'],
  recordLow: ['Bunnrekord.. {beer} får kveldens laveste snitt hittil: {avg}. Det svir!'],
  climb: ['BYKS PÅ TABELLEN! {name} klatrer fra {from}. til {to}. plass!', '{name} på vei oppover! Fra {from}. til {to}. plass – se opp i toppen!'],
  fall: ['Stup! {name} faller fra {from}. til {to}. plass.. Tung kveld?', 'Au da. {name} glir ned fra {from}. til {to}. plass!'],
  standingClose: ['NERVEPIRRENDE! {name} leder, men bare {margin} poeng foran {second}!', 'Knivskarpt i toppen! {margin} poeng skiller {name} og {second}!'],
  standingBig: ['Knusende! {name} leder med hele {margin} poeng ned til {second}!', '{name} rømmer! {margin} poeng foran {second} – kan noen stoppe dette?!'],
  standing: ['Stillingen: {name} leder, {margin} poeng foran {second}. Fortsatt alt å spille for!'],
  selfSix: ['Selvtillit! {name} gir sin egen {beer} en sekser! Helt lovlig – men vi la merke til det!'],
  award: ['Nå er stemmene klare. Nå er alt avgjort! Dråpen er drukket! Terningen kastet! Stemmene talt. Det er over! Det er i land! Årets juleølkonkurranse er i mål, dere!'],
  awardCta: ['Og vinneren av Gulmasse \'26 er… 🥁 Trykk «Show award ceremony»!'],
  missIdle: [
    'Åh, det merkes jo at vi savner {vet} i år.. stemningen er bra, men det blir liksom ikke heeeelt det samme uten den sluggeren.',
    'Litt pause i programmet.. Man kan nesten høre ekkoet av pitchene til {vet} fra tidligere år. Savnet er stort!',
    'Mens vi venter: har noen hørt fra {vet}? Det står liksom en tom stol rundt ølbordet i år.. og ingen fyller den helt.',
  ],
  missStumble: [
    'Ja, der ser vi det altså, uten at {vet} er på deltakerlisten så er det noe snubling i feltet..',
    '{name} snubler.. Og hvem ville ha stått klar med et klapp på skulderen og en reserveøl? {vet}, selvsagt. Savnet!',
  ],
  beerHistory: [],
  missStrong: [
    'Åhoi! En såpass sterk plassering fra {name}! Spørs om det samme hadde skjedd om {vet} hadde sittet rundt ølbordet i år. Spesielt pitchen er gjerne bedre hos en veteran enn hos en nybegynner.',
    'Sterkt levert av {name}! Men vi må jo spørre oss: hadde {vet} latt det skje? Det får vi aldri vite i år..',
  ],
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
    pick: ['The wheel picks Claus – {beer}. Delirium won in 2021, but only came 5th when Adam brought it in 2022. Revenge tonight?!'],
    leader: ['Claus takes the lead! A seasoned veteran who has never quite reached the top of the podium. Is tonight the night?!'],
  },
  carlpetter: {
    pick: [
      'The wheel picks Carl Petter – {beer}. New to the game this year – will being a vegetarian hold him back..? The tension is unbearable!',
      'Carl Petter with {beer}! He has cleared snow in Oslo with a tractor and the full kit – now he\'s clearing a path to the top!',
      'Carl Petter with {beer}! Snow plough driver, and a kebab after every shift. A vegetarian, mind you.. So many questions!',
      'Carl Petter with {beer}! Familiar? YES – Eirik brought Père Noël back in 2022! Will it do better in new hands?!',
    ],
    leader: ['Carl Petter takes the lead. Good heavens! A vegetarian in front!', 'Carl Petter ploughs past everyone! The snow-clearing tractor man takes the lead – kebab tonight!'],
  },
  nora: {
    pick: [
      'The wheel picks Nora – {beer}! Not Noora! Not «I need some space!»-Nooorra. Not Skam-Nooora who made out with William! This is a much better version: Nora!',
      'Nora with {beer}! Concise. Sharp. You can practically touch the beginner\'s luck!',
      'Nora with {beer}! A stage veteran from the school revue – it was in the local paper! Now a new stage awaits!',
      'Nora with {beer}! She has trekked the Manaslu region in Nepal – a beer presentation is nothing after the Himalayas?!',
      'Nora with {beer}! She gets her best ideas at the liquor store – was {beer} one of them?!',
    ],
    leader: ['Nora takes the lead! Beginner\'s luck strikes – concise, sharp and in front!'],
  },
  aurora: {
    pick: ['The wheel picks Aurora – {beer}! Steiner school, Berkeley and a great singing voice – will there be SINGING in the presentation?!', 'Aurora with {beer}! A newcomer – nobody knows what to expect!', 'Aurora with {beer}! She has danced with Michael Jackson at Valle Hovin – moonwalk in the presentation?!'],
    leader: ['Aurora takes the lead! The newcomer is giving the veterans a run for their money!', 'Aurora in front! She\'s singing her way to the top!', 'Aurora takes the lead! She danced with Michael Jackson – now she\'s moonwalking past the whole field!'],
    pres6: ['A six for Aurora\'s presentation! That singing voice works wonders!'],
  },
  eirik: {
    pick: ['The wheel picks Eirik – {beer}! Straight from his own NukeBrew brewery – «the essence of pure flavor»! Or will he fall on his own sword again?'],
    leader: ['Eirik takes the lead! NukeBrew in front – just don\'t fall on your own sword now!'],
  },
  tomas: {
    pick: [
      'The wheel picks Tomas – {beer}! The host and inventor himself! 6th year, never won. Eternal loser? We\'ll see..',
      'Tomas with {beer}! Seriously bought in Kyiv – and smuggled past both Polish AND Moldovan border guards! If THAT doesn\'t earn a six for the presentation, what will?!',
    ],
    leader: ['Tomas takes the lead!! The host in front! Is the curse finally broken?!'],
    selfSix: ['Oh my! A 6 for Tomas – FROM Tomas! As sneaky this year as every year before.. but it\'s within the rules!'],
  },
  kathinka: {
    pick: [
      'The wheel picks Kathinka – {beer}! The 2021 winner – there was dancing and sock-sliding! Get your socks ready!',
      'Kathinka with {beer} – the same beer she brought in 2022, when it finished 9th, second to last.. REVENGE or another letdown?!',
    ],
    leader: ['Kathinka takes the lead! Sock-slide alert! The 2021 champion is back in front!'],
  },
  magnus: {
    pick: ['The wheel picks Magnus – {beer}! Young Magnus! Will Gen Z ever learn to like beer?!'],
    leader: ['Magnus takes the lead! Gen Z in front! The millennials are scratching their heads!'],
  },
  adam: {
    pick: ['The wheel picks Adam – {beer}! Adam-san! English through and through – but he was in Japan in April, and Adam-san suits him perfectly! All Christmas-beer boss!'],
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
  beer5: ['A five for {beer}! Smells like a podium finish, folks!'],
  beer2: ['A two for {beer}.. not what {name} was hoping for..'],
  beer1: ['Ouch! A one for {beer}.. someone in the room is NOT impressed!'],
  pres5: ['A five for the presentation! {name} has the room in the palm of their hand!'],
  presLow: ['Meh.. a low score for {name}\'s presentation.. will it hold up in the end??'],
  pres1: ['A ONE for the presentation?! Someone fell asleep during {name}\'s speech..'],
  halfway: ['Halfway! Half the room has voted on {beer} – {avg} average so far!'],
  allVoted: ['Everyone has voted on {beer}! Average {avg}. {verdict}'],
  recordHigh: ['NEW RECORD! {beer} gets the highest average of the night so far: {avg}!'],
  recordLow: ['Rock bottom.. {beer} gets the lowest average of the night so far: {avg}. Ouch!'],
  climb: ['BIG JUMP! {name} climbs from {from} to {to}!'],
  fall: ['Free fall! {name} drops from {from} to {to}.. tough night?'],
  standingClose: ['NAIL-BITING! {name} leads, but only {margin} points ahead of {second}!'],
  standingBig: ['Crushing! {name} leads by a massive {margin} points over {second}!'],
  standing: ['Standings: {name} leads, {margin} points ahead of {second}. Still everything to play for!'],
  selfSix: ['Confidence! {name} gives their own {beer} a six! Perfectly legal – but we noticed!'],
  award: ['The votes are in. It\'s all decided! The last drop is drunk! The dice are cast! The votes are counted. It\'s over! It\'s done! This year\'s Christmas beer competition is in the books, folks!'],
  awardCta: ['And the winner of Gulmasse \'26 is… 🥁 Press «Show award ceremony»!'],
  missIdle: [
    'Oh, you can really tell we\'re missing {vet} this year.. the mood is great, but it\'s just not quiiiite the same without that slugger.',
    'A little break in the programme.. You can almost hear the echo of {vet}\'s pitches from years gone by. Sorely missed!',
    'While we wait: has anyone heard from {vet}? There\'s an empty chair at the beer table this year.. and nobody quite fills it.',
  ],
  missStumble: [
    'And there you have it – without {vet} on the list, the field is stumbling a bit..',
    '{name} stumbles.. And who would have been there with a pat on the back and a spare beer? {vet}, of course. Missed!',
  ],
  beerHistory: [],
  missStrong: [
    'Ahoy! Such a strong placing from {name}! Would it have happened if {vet} had been sitting at the beer table this year? The pitch is usually better from a veteran than from a beginner.',
    'Strong stuff from {name}! But we have to ask: would {vet} have let that happen? We\'ll never know this year..',
  ],
};

const EN_VERDICT = (avg: number) =>
  avg >= 5 ? 'This is TOP class, folks!' : avg >= 4 ? 'Strong showing!' : avg >= 3 ? 'Solidly mid-table.' : 'Tough. Very tough.';

// ── Japanese ─────────────────────────────────────────────────────────────────
const JA_PEOPLE: Record<string, Lines> = {
  martin: {
    pick: [
      'ルーレットが選んだのはマーティン – {beer}！去年のチャンピオンだ！これは目が離せない！',
      'マーティン登場、{beer}！ビール通、レジェンド、世界を旅する男 – そして現チャンピオン！コンラッドの優勝回数に並べるか？！',
    ],
    leader: [
      'マーティンがトップに！前回王者が本領発揮 – トロフィーはもう一年マーティンの手に？！',
      'マーティン首位！出場2回で優勝1回 – 連覇の香りがしてきた！コンラッド、後ろに気をつけろ！',
    ],
  },
  claus: {
    pick: [
      'ルーレットが選んだのはクラウス – {beer}。デリリウムは2021年に優勝、でも2022年にアダムが持ってきた時は5位。今夜はリベンジなるか？！',
      'クラウスと{beer}！百戦錬磨のベテラン – でも表彰台の頂点にはまだ立ったことがない。今年こそ？！',
    ],
    leader: ['クラウスがトップに！すっかりベテランだが、表彰台の頂点はまだ未経験。今夜がその夜か？！'],
  },
  carlpetter: {
    pick: [
      'ルーレットが選んだのはカール・ペッター – {beer}。今年初参加！ベジタリアンなのは不利になるのか…？緊張感がすごい！',
      'カール・ペッターと{beer}！トーマス、アダム、マグヌスに続く、スキンヘッド4号！リブの脂なしで味覚は大丈夫か？！',
      'カール・ペッターと{beer}！オスロでトラクターとフル装備で除雪していた男 – 今度は頂点への道を切り開く！',
      'カール・ペッターと{beer}！除雪作業員、仕事の後はいつもケバブ。ベジタリアンなのに…謎は深まる！',
      'カール・ペッターと{beer}！見覚えある？そう – エイリクが2022年に持ってきたペール・ノエルだ！新しい手で結果は変わるか？！',
    ],
    leader: ['カール・ペッターがトップに。なんてこった！ベジタリアンが首位だ！', 'スキンヘッド4号が首位！！リブを一口も食べずにトップに立った！', 'カール・ペッターが全員を除雪して首位に！今夜はケバブだ！'],
  },
  nora: {
    pick: [
      'ルーレットが選んだのはノラ – {beer}！ノーラじゃない！「ちょっとスペースが欲しいの！」のノーーラでもない。ウィリアムといちゃついたSKAMのノーーラでもない！こっちはずっと良いバージョン：ノラ！',
      'ノラと{beer}！簡潔。シャープ。ビギナーズラックが手に取るようにわかる！',
      'ノラと{beer}！学生時代のレビューで地元紙に載った舞台経験者！新しい舞台が待っている！',
      'ノラと{beer}！ネパールのマナスル地方をトレッキングした彼女 – ヒマラヤの後ならビールのプレゼンなんて楽勝？！',
      'ノラと{beer}！最高のアイデアは酒屋で浮かぶという彼女 – {beer}もその一つ？！',
    ],
    leader: ['ノラがトップに！ビギナーズラック炸裂 – 簡潔、シャープ、そして首位！'],
  },
  aurora: {
    pick: ['ルーレットが選んだのはアウロラ – {beer}！シュタイナー学校、バークレー、そして素晴らしい歌声 – プレゼンで歌が聴ける？！', 'アウロラと{beer}！帽子をかぶって、いざ勝負！', 'アウロラと{beer}！ヴァッレ・ホーヴィンでマイケル・ジャクソンと踊った彼女 – プレゼンでムーンウォーク？！'],
    leader: ['アウロラがトップに！新人がベテランたちを脅かしている！', 'アウロラ首位！歌声でトップへ！', 'アウロラがトップに！マイケル・ジャクソンと踊った彼女 – ムーンウォークで全員を抜き去る！'],
    pres6: ['アウロラのプレゼンに6点！あの歌声は効果抜群！'],
  },
  eirik: {
    pick: [
      'ルーレットが選んだのはエイリク – {beer}！自身の醸造所ヌークブルー直送 – 「純粋な風味のエッセンス」！それとも、また自分の剣に倒れるのか？',
      'ヌークブルーが登場！エイリクと{beer} – 自家醸造、恐れ知らず！',
      'エイリクと{beer}！2022年はペール・ノエルだったが – 今年は自分で醸造。勇敢か、無謀か？！',
    ],
    leader: ['エイリクがトップに！ヌークブルーが首位 – あとは自分の剣に倒れないことだけ！'],
    beer1: ['痛い！{beer}に1点…エイリク、また自分の剣に倒れたか？！'],
  },
  tomas: {
    pick: [
      'ルーレットが選んだのはトーマス – {beer}！主催者にして発明者本人！今年で6年目。優勝経験なし。永遠の敗者？さてどうなる…',
      '主催者の登場！トーマスと{beer} – ついに今年こそ？！',
      'トーマスと{beer}！本当にキーウで買って、ポーランドとモルドバの国境警備隊の目をくぐり抜けて持ち込んだ！これでプレゼン6点じゃなかったら何なんだ？！',
    ],
    leader: ['トーマスがトップに！！主催者が首位！6年間未勝利 – ついに呪いが解けるか？！'],
    selfSix: ['おやおや！トーマスに6点 – トーマスから！例年どおりちゃっかりしてる…でもルール上はOK！'],
  },
  kathinka: {
    pick: [
      'ルーレットが選んだのはカティンカ – {beer}！2021年の優勝者 – あの時はダンスと靴下スライディング！靴下の準備を！',
      'カティンカと{beer}！セント・ベルナルデュスは第1回、2020年の優勝ビール – 王座奪還なるか？！',
      'カティンカと{beer} – 2022年と同じビール！あの時は9位、最後から2番目…リベンジか、また撃沈か？！',
    ],
    leader: ['カティンカがトップに！靴下スライディング警報！2021年の女王が首位に返り咲き！', 'カティンカ首位！2022年は同じビールで最後から2番目 – 今はトップ！見事な逆転！'],
  },
  magnus: {
    pick: [
      'ルーレットが選んだのはマグヌス – {beer}！若手マグヌス！Z世代はビールを好きになれるのか？そもそもビールが何か知ってる？！',
      'マグヌスと{beer}！ジョーカー登場 – ミレニアル世代のベテランたちはどう投票する？！',
    ],
    leader: ['マグヌスがトップに！Z世代が首位！ミレニアル世代は首をかしげている！'],
  },
  adam: {
    pick: ['ルーレットが選んだのはアダム – {beer}！アダムさん！生粋のイギリス人 – でも4月に日本に行ったので、アダムさんがぴったり！そして完全なクリスマスビールのボス！', 'アダムさんと{beer}！プレゼンで6点を取れなければ、勝負はまったくわからない！'],
    leader: ['アダムさんがトップに！クリスマスビールのボスが格の違いを見せる！'],
    pres6: ['アダムさんのプレゼンに6点！さすがクリスマスビールのボス！'],
    presLow: ['えっ？！アダムさんのプレゼンに低評価？！これで勝負はまったくわからなくなった！'],
  },
  trondolav: {
    pick: [
      'ルーレットが選んだのはトロン・オーラヴ！来るかどうか誰にもわからない – でも必ず来るお隣さん！今日はどこに？ポルトガル？サルデーニャ？ヘルシンキ？',
      'お隣さんトロン・オーラヴ登場！そもそもビールは決まってる？誰も知らない！',
    ],
    leader: ['トロン・オーラヴがトップに！お隣さんがどこからともなく現れた – いつものように！'],
  },
};

const JA_GENERIC: Record<CommentKind, string[]> = {
  pick: ['ルーレットが選んだのは{name} – {beer}！帽子をかぶって、いざ勝負！', '{name}に決定！{beer}が試される – 緊張が高まる！'],
  leader: ['{name}がトップに！会場が沸いている！', '{name}が首位！しっかりつかまって！'],
  beer6: ['{name}のビールに6点…！！すごい！{beer}に6点！これで何でも起こりうる！', '6点！{beer}がど真ん中！{name}大喜び！'],
  pres6: ['{name}のプレゼンに6点！スタンディングオベーション！', 'ショーに満点！{name}、6点のプレゼン！'],
  double6: ['{name}にダブル6！ビールもプレゼンも！これは歴史的瞬間だ！'],
  beer5: ['{beer}に5点！表彰台の香りがする！', '{name}に力強い5点！{beer}、いい仕事！'],
  beer2: ['{beer}に2点…{name}が望んでいたのはこれじゃない…', 'うーん、2点。{beer}、上り坂で苦戦！'],
  beer1: ['痛い！{beer}に1点…会場の誰かは全然納得していない！', '1点！見ていて辛い。{beer}、ボコボコだ！'],
  pres5: ['プレゼンに5点！{name}が会場を掌握！', 'ピッチが決まった！{name}のショーに5点！'],
  presLow: ['うーん…{name}のプレゼンは少し減点…最後まで持ちこたえられるか？？'],
  pres1: ['プレゼンに1点？！{name}のスピーチ中に誰か寝ちゃったみたい…', '痛い！ショーに1点。{name}、話術を磨かないと！'],
  halfway: ['折り返し！{beer}に半数が投票 – 現在の平均は{avg}！', '勝負は小休止？いや、まだまだ！会場の半分が投票済み – 現時点で平均{avg}！'],
  allVoted: ['全員が{beer}に投票！平均{avg}。{verdict}'],
  recordHigh: ['新記録！{beer}が今夜の最高平均：{avg}！', '歴史的！{name}が平均{avg}で今夜の記録を樹立！'],
  recordLow: ['最低記録…{beer}が今夜の最低平均：{avg}。これは痛い！'],
  climb: ['大躍進！{name}が{from}位から{to}位へ！', '{name}が上昇中！{from}位から{to}位へ – 上位陣は要注意！'],
  fall: ['急降下！{name}が{from}位から{to}位へ…厳しい夜？', 'あらら。{name}が{from}位から{to}位に後退！'],
  standingClose: ['手に汗握る！{name}が首位、でも{second}とはわずか{margin}点差！', 'トップは大接戦！{name}と{second}の差は{margin}点！'],
  standingBig: ['圧倒的！{name}が{second}に{margin}点もの大差で首位！', '{name}が独走！{second}に{margin}点差 – 誰か止められるか？！'],
  standing: ['現在の順位：{name}が首位、{second}に{margin}点差。まだまだ勝負はこれから！'],
  selfSix: ['自信満々！{name}が自分の{beer}に6点！完全に合法 – でも見てたよ！'],
  award: ['投票は終わった。すべてが決まった！最後の一滴は飲み干された！サイは投げられた！票は数えられた！終わった！決着だ！今年のクリスマスビール大会、ゴールです！'],
  awardCta: ['そしてGulmasse \'26の優勝者は… 🥁「Show award ceremony」を押してください！'],
  missIdle: [
    'ああ、今年は{vet}がいなくて寂しい…雰囲気は最高だけど、あの強打者がいないと、なーんか少し違うんだよね。',
    'プログラムはちょっと休憩…過去の{vet}の名プレゼンが今にも聞こえてきそう。寂しい！',
    '待っている間に：{vet}から連絡あった人いる？今年はビールのテーブルに空いた椅子がひとつ…誰も埋められない。',
  ],
  missStumble: [
    'ほら、見てのとおり。{vet}が参加者リストにいないと、みんなちょっとつまずき気味…',
    '{name}がつまずいた…肩をたたいて予備のビールを差し出してくれたのは誰？もちろん{vet}だ。寂しい！',
  ],
  beerHistory: [],
  missStrong: [
    'おーい！{name}がこんなに好成績！もし{vet}が今年ビールのテーブルにいたら、同じ結果になったかな。特にプレゼンは、初心者よりベテランの方がうまいものだから。',
    '{name}、お見事！でも聞かずにはいられない：{vet}がいたら、これを許したかな？今年は永遠の謎…',
  ],
};

const JA_VERDICT = (avg: number) =>
  avg >= 5 ? 'これはトップクラスだ！' : avg >= 4 ? '力強い結果！' : avg >= 3 ? '堅実な中位。' : '厳しい。非常に厳しい。';

/** Returns a commentator line, or null when this language has no commentator (fallback to plain text). */
export function commentary(
  lang: Lang,
  kind: CommentKind,
  p: CommentParams,
  seed: number,
  formatAvg: (n: number | null | undefined) => string,
): string | null {
  const people = lang === 'no' ? NO_PEOPLE : lang === 'ja' ? JA_PEOPLE : EN_PEOPLE;
  const generic = lang === 'no' ? NO_GENERIC : lang === 'ja' ? JA_GENERIC : EN_GENERIC;
  const verdict = lang === 'no' ? NO_VERDICT : lang === 'ja' ? JA_VERDICT : EN_VERDICT;
  let pool: string[] | undefined;
  if (kind === 'beerHistory') {
    pool = getBeerHistory(p.beer || '')?.pick[lang];
    if (!pool?.length) return null;
  } else {
    const personal = people[keyOf(p.name || '')]?.[kind];
    pool = personal && personal.length ? personal : generic[kind];
  }
  const line = pool[Math.abs(seed) % pool.length];
  const vet = p.vet || vetFor(seed);
  const beer = (p.beer || '').trim() || (lang === 'no' ? 'ølen' : lang === 'ja' ? 'ビール' : 'the beer');
  return line
    .replace(/\{name\}/g, p.name || '')
    .replace(/\{beer\}/g, beer)
    .replace(/\{avg\}/g, formatAvg(p.avg ?? null))
    .replace(/\{verdict\}/g, p.avg != null ? verdict(p.avg) : '')
    .replace(/\{from\}/g, String(p.from ?? ''))
    .replace(/\{to\}/g, String(p.to ?? ''))
    .replace(/\{margin\}/g, formatAvg(p.margin ?? null).replace(/[.,]00$/, '').replace(/([.,]\d)0$/, '$1'))
    .replace(/\{second\}/g, p.second || '')
    .replace(/\{vet\}/g, vet)
    .replace(/ – !/g, '!')
    .trim();
}
