"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EventInfo = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  location: string | null;
  event_date: string | null;
  event_time: string | null;
  formatted_date: string | null;
  status: string;
  registration_open: boolean;
  max_participants: number | null;
  invite_code: string;
};

type Props = {
  code: string;
  token?: string | null;
};

export default function InviteRegistration({ code, token }: Props) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    status: string;
    invite_token?: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rsvp, setRsvp] = useState<"accepted" | "declined">("accepted");
  const [bringingBeer, setBringingBeer] = useState(true);
  const [beerNote, setBeerNote] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);

  const heading = useMemo(
    () => event?.name || "Gulmasse",
    [event?.name],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (token) {
          const res = await fetch(`/api/registrations/${encodeURIComponent(token)}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Kunne ikke hente invitasjon");
          if (cancelled) return;
          setEvent(data.event);
          setName(data.registration?.name || "");
          setEmail(data.registration?.email || "");
          setPhone(data.registration?.phone || "");
          if (data.registration?.bringing_beer != null) {
            setBringingBeer(!!data.registration.bringing_beer);
          }
          setBeerNote(data.registration?.beer_note || "");
          setMessage(data.registration?.message || "");
          if (data.registration?.status === "accepted" || data.registration?.status === "declined") {
            setRsvp(data.registration.status);
          }
        } else {
          const res = await fetch(`/api/events/${encodeURIComponent(code)}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Event ikke funnet");
          if (cancelled) return;
          setEvent(data.event);
          setSpotsLeft(data.counts?.spots_left ?? null);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Noe gikk galt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Skriv inn navnet ditt");
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        const res = await fetch(`/api/registrations/${encodeURIComponent(token)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: rsvp,
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            bringing_beer: bringingBeer,
            beer_note: beerNote.trim() || undefined,
            message: message.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Kunne ikke lagre svar");
        setDone({
          message:
            rsvp === "accepted"
              ? "Takk! Du er påmeldt."
              : "Svaret ditt er lagret. Hyggelig om du får det til en annen gang!",
          status: data.registration?.status || rsvp,
          invite_token: data.registration?.invite_token,
        });
      } else {
        const res = await fetch(`/api/events/${encodeURIComponent(code)}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            status: rsvp,
            bringing_beer: bringingBeer,
            beer_note: beerNote.trim() || undefined,
            message: message.trim() || undefined,
            invite_code: event?.invite_code,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Kunne ikke melde deg på");
        setDone({
          message: data.message || "Påmelding lagret!",
          status: data.registration?.status || (data.waitlisted ? "waitlist" : rsvp),
          invite_token: data.registration?.invite_token,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 text-center text-sm text-zinc-600 shadow-sm">
        Henter invitasjon…
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white/95 p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Fant ikke invitasjonen</h2>
        <p className="mt-2 text-sm text-zinc-600">{error || "Sjekk lenken og prøv igjen."}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 underline">
          Til forsiden
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
          {event.tagline || "Invitasjon"}
        </p>
        <h2 className="text-2xl font-semibold text-zinc-900">{heading}</h2>
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            done.status === "declined"
              ? "bg-zinc-100 text-zinc-700"
              : done.status === "waitlist"
                ? "bg-amber-50 text-amber-900"
                : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {done.message}
        </div>
        {done.invite_token && done.status !== "declined" && (
          <p className="text-xs text-zinc-500">
            Lagre denne lenken for å endre svaret ditt senere:{" "}
            <a
              className="underline"
              href={`/invitasjon/${encodeURIComponent(event.invite_code)}?token=${done.invite_token}`}
            >
              Min påmelding
            </a>
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-white active:opacity-90"
          >
            Til konkurranseappen
          </Link>
          <button
            type="button"
            className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
            onClick={() => setDone(null)}
          >
            Endre svar
          </button>
        </div>
      </div>
    );
  }

  const closed = !event.registration_open || event.status === "archived" || event.status === "draft";

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
          {event.tagline || "Du er invitert"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">{heading}</h1>
        {event.formatted_date && (
          <p className="mt-2 text-sm font-medium text-zinc-800">{event.formatted_date}</p>
        )}
        {event.location && (
          <p className="text-sm text-zinc-600">Sted: {event.location}</p>
        )}
        {event.description && (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">{event.description}</p>
        )}
        {spotsLeft != null && (
          <p className="mt-3 text-xs text-zinc-500">{spotsLeft} plasser igjen</p>
        )}
      </header>

      {closed ? (
        <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 text-sm text-zinc-700 shadow-sm">
          Påmelding er stengt for dette arrangementet.
          <div className="mt-3">
            <Link href="/" className="text-blue-600 underline">
              Gå til appen
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-zinc-900">Påmelding</h2>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Navn *</label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fornavn"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">E-post</label>
            <input
              type="email"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="valgfritt"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Telefon</label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="valgfritt"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-zinc-600">Kommer du?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rsvp"
                checked={rsvp === "accepted"}
                onChange={() => setRsvp("accepted")}
              />
              Ja, jeg kommer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rsvp"
                checked={rsvp === "declined"}
                onChange={() => setRsvp("declined")}
              />
              Nei, dessverre ikke
            </label>
          </fieldset>

          {rsvp === "accepted" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bringingBeer}
                  onChange={(e) => setBringingBeer(e.target.checked)}
                />
                Jeg tar med øl til konkurransen
              </label>
              {bringingBeer && (
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Øl / stil (valgfritt)</label>
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
                    value={beerNote}
                    onChange={(e) => setBeerNote(e.target.value)}
                    placeholder="F.eks. julebrygg, stout…"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Melding til verten</label>
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Valgfritt"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Sender…" : rsvp === "accepted" ? "Meld meg på" : "Send svar"}
          </button>
        </form>
      )}
    </div>
  );
}
