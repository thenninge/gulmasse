"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Info-only page: what Gulmasse is (no signup CTAs). */
export default function InvitePage() {
  const [eventDate, setEventDate] = useState<string | null>("lørdag 28. november 2026");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/events/active");
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data?.event) return;
        if (data.event.formatted_date) setEventDate(data.event.formatted_date);
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
          Christmas Beer Competition
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
          Velkommen til Gulmasse &apos;26!
        </h1>
        {eventDate && (
          <p className="mt-2 text-sm font-medium text-zinc-800">{eventDate}</p>
        )}
      </header>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Hva er Gulmasse?</h2>
        <div className="space-y-3 text-sm leading-relaxed text-zinc-700">
          <p>
            Det er en juleøl-event. Istedenfor å komme på juleølsmaking, skal du som
            deltaker ta med en juleøl du mener kan være årets beste! Pass på at du
            ikke melder på en juleøl som allerede noen andre har påmeldt.
            Dobbelbooking unngås dermed.
          </p>
          <p>
            Det vil si at du må kjøpe inn et par flasker (tenk, hvor mye av denne
            hadde du klart selv…?) som deles på alle deltakere. Og alle deltakere
            deler såklart på deg :) Avhengig av alkoholprosent er 2–3 × 0,33 L
            passe.
          </p>
          <p>
            Legg opp strategien riktig, her vil konkurransen bli hard! Vinneren tar
            med et vandretrofé hjem. Hver øl presenteres for de andre når det er
            din tur.
          </p>
          <p>
            Vertskapet serverer solid og god mat, så du trenger ikke tenke på noe
            annet enn strategi og presentasjon! Poeng gis pr smak, presentasjon, og
            diverse x-faktorer som dukker opp ila kvelden :)
          </p>
        </div>
      </section>

      <div className="pt-1">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white active:opacity-90"
        >
          Tilbake til appen
        </Link>
      </div>
    </div>
  );
}
