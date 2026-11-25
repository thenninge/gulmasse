import { NextResponse } from 'next/server';

/**
 * The old «Start Gulmasse '26 (slett live-data)» wipe deleted this year's live
 * participants. It is permanently disabled so no stale browser tab or button can
 * run it again. Use «Ny konkurranse» in Admin tools to clear tonight's votes and
 * picks while keeping participants.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Denne funksjonen er slått av. Bruk «Ny konkurranse» for å nullstille poeng (deltakere beholdes).' },
    { status: 410 },
  );
}
