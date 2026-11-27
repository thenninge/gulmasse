"use client";

import { getProfile } from "@/lib/participantBios";

type Props = {
  name: string;
  beerName: string;
  producer: string;
  beerType: string;
  abv: string;
  image: string | null;
  /** null when scores are hidden */
  rank: number | null;
  points: number | null;
  onClose: () => void;
};

/** Lobby «info page» for one participant: who they are + what they bring. */
export default function ParticipantInfoModal({ name, beerName, producer, beerType, abv, image, rank, points, onClose }: Props) {
  const profile = getProfile(name);
  const emoji = profile?.emoji ?? "🍺";
  const tagline = profile?.tagline ?? "Deltaker";
  const bio = profile?.bio ?? [`${name} er med på Gulmasse i år! Vi vet ikke så mye ennå – men stemmene vil avsløre alt.`];
  const facts = profile?.facts ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Om ${name}`}
      data-testid="participant-info"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-white text-zinc-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
          onClick={onClose}
          aria-label="Lukk"
        >
          ✕
        </button>

        <div className="rounded-t-2xl bg-gradient-to-b from-amber-100 to-white px-5 pb-3 pt-6 text-center">
          <div className="text-5xl leading-none" aria-hidden>{emoji}</div>
          <h3 className="mt-2 text-2xl font-bold [overflow-wrap:anywhere]">{name}</h3>
          <div className="text-sm font-medium uppercase tracking-wide text-amber-800">{tagline}</div>
          {rank != null && points != null && (
            <div className="mt-2 inline-block rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white tabular-nums">
              #{rank} · {points.toFixed(1)} poeng
            </div>
          )}
        </div>

        <div className="space-y-3 px-5 pb-2 text-sm leading-relaxed">
          {bio.map((para, i) => (
            <p key={i} className="[overflow-wrap:anywhere]">{para}</p>
          ))}
        </div>

        {facts.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 px-5 py-2">
            {facts.map((f) => (
              <span key={f} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900 ring-1 ring-amber-200">
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="mx-5 mb-5 mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Årets øl</div>
          {beerName ? (
            <div className="flex items-center gap-3">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={beerName} className="h-24 w-16 shrink-0 rounded-md object-contain" />
              )}
              <div className="min-w-0 space-y-0.5 text-sm">
                <div className="font-semibold [overflow-wrap:anywhere]">{beerName}</div>
                {producer && <div className="text-zinc-600 [overflow-wrap:anywhere]">{producer}</div>}
                {(beerType || abv) && (
                  <div className="text-zinc-600">{[beerType, abv ? `${abv}%` : ""].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Ikke registrert ennå – hemmelig?</div>
          )}
        </div>
      </div>
    </div>
  );
}
