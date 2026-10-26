"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Step = "info" | "yes" | "done";

type DoneState = {
  status: "accepted" | "declined";
  message: string;
  pin?: string;
  name?: string;
};

export default function InvitePage() {
  const [eventDate, setEventDate] = useState<string | null>("lørdag 28. november 2026");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/events/active");
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data?.event) return;
        if (data.event.formatted_date) setEventDate(data.event.formatted_date);
        setRegistrationOpen(!!data.event.registration_open && data.event.status !== "archived");
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitAccepted(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Skriv inn navnet ditt");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN må være 4 siffer");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invite/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted", name: name.trim(), pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke melde deg på");
      localStorage.setItem("pin", pin);
      setDone({
        status: "accepted",
        message: data.message || "Du er påmeldt!",
        pin,
        name: name.trim(),
      });
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDeclined() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/invite/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "declined", name: name.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke lagre svar");
      setDone({
        status: "declined",
        message: data.message || "Takk for svaret!",
      });
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setSubmitting(false);
    }
  }

  if (done && step === "done") {
    return (
      <div className="space-y-5">
        <header className="rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Velkommen til Gulmasse &apos;26!
          </h1>
        </header>
        <div
          className={`rounded-2xl border px-5 py-4 text-sm shadow-sm ${
            done.status === "accepted"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-zinc-200 bg-white/95 text-zinc-700"
          }`}
        >
          <p className="font-medium">{done.message}</p>
          {done.status === "accepted" && done.pin && (
            <div className="mt-3 space-y-1">
              <p>
                Navn: <span className="font-semibold">{done.name}</span>
              </p>
              <p>
                PIN: <span className="font-mono text-lg font-semibold tracking-widest">{done.pin}</span>
              </p>
              <p className="text-xs text-emerald-800/80">
                Lagre PIN-koden – den bruker du for å logge inn på kvelden.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {done.status === "accepted" ? (
            <Link
              href="/"
              className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-white active:opacity-90"
            >
              Gå til appen
            </Link>
          ) : (
            <button
              type="button"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 active:bg-zinc-50"
              onClick={() => {
                setDone(null);
                setStep("info");
                setError(null);
              }}
            >
              Tilbake til invitasjonen
            </button>
          )}
        </div>
      </div>
    );
  }

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

      {!registrationOpen ? (
        <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 text-sm text-zinc-700 shadow-sm">
          Påmelding er stengt for øyeblikket.
          <div className="mt-3">
            <Link href="/" className="text-blue-600 underline">
              Gå til appen
            </Link>
          </div>
        </div>
      ) : step === "info" ? (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Stiller du?</h2>
          <p className="text-sm text-zinc-600">
            Velg JA for å melde deg på og sette opp bruker (navn + PIN).
          </p>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-4 text-base font-medium text-white active:opacity-90 disabled:opacity-60"
              onClick={() => {
                setError(null);
                setStep("yes");
              }}
            >
              JA, jeg stiller
            </button>
            <button
              type="button"
              disabled={submitting}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-4 text-base font-medium text-zinc-800 active:bg-zinc-50 disabled:opacity-60"
              onClick={submitDeclined}
            >
              {submitting ? "Sender…" : "Nei, jeg kan ikke stille"}
            </button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={submitAccepted}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-zinc-900">Sett opp bruker</h2>
          <p className="text-sm text-zinc-600">
            Velg navn og en 4-sifret PIN du bruker for å logge inn senere.
          </p>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Navn *</label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fornavn"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">PIN (4 siffer) *</label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="____"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
              onClick={() => {
                setStep("info");
                setError(null);
              }}
            >
              Tilbake
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white active:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Melder på…" : "Bekreft påmelding"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
