"use client";

import { useEffect, useState } from "react";
import { resolveBeerImage } from "@/lib/beerImages";

export type HostParticipant = {
  pin: string;
  nickname: string | null;
  active: boolean;
  beer_name?: string | null;
  producer?: string | null;
  beer_type?: string | null;
  abv?: number | null;
  beer_image_url?: string | null;
};

type Props = {
  hostPin: string;
  participant: HostParticipant;
  onChanged: () => void;
  onDelete: () => void;
};

const BEER_TYPES = [
  "Barleywine",
  "Brown ale",
  "Belgian Double",
  "Belgian Quad",
  "Belgian Tripple",
  "Bock",
  "Dobblebock",
  "Double IPA",
  "Home Brew",
  "Imperial Stout",
  "IPA",
  "Julebrygg",
  "Lager",
  "Mjød",
  "Nuclear Surprise",
  "Other",
  "Pilsner",
  "Stout",
  "Tripplebock",
];

export default function HostParticipantEditor({
  hostPin,
  participant,
  onChanged,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(participant.nickname || "");
  const [beerName, setBeerName] = useState(participant.beer_name || "");
  const [producer, setProducer] = useState(participant.producer || "");
  const [beerType, setBeerType] = useState(participant.beer_type || "");
  const [customType, setCustomType] = useState("");
  const [abv, setAbv] = useState(
    participant.abv != null && Number.isFinite(Number(participant.abv))
      ? Number(participant.abv).toFixed(1)
      : "",
  );
  const [active, setActive] = useState(!!participant.active);
  const [imageUrl, setImageUrl] = useState(participant.beer_image_url || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNickname(participant.nickname || "");
    setBeerName(participant.beer_name || "");
    setProducer(participant.producer || "");
    const t = (participant.beer_type || "").trim();
    if (t && !BEER_TYPES.includes(t)) {
      setBeerType("__custom__");
      setCustomType(t);
    } else {
      setBeerType(t);
      setCustomType("");
    }
    setAbv(
      participant.abv != null && Number.isFinite(Number(participant.abv))
        ? Number(participant.abv).toFixed(1)
        : "",
    );
    setActive(!!participant.active);
    setImageUrl(participant.beer_image_url || null);
  }, [participant]);

  const preview = resolveBeerImage({
    beer_image_url: imageUrl,
    name: nickname || participant.nickname,
  });

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const typeValue = beerType === "__custom__" ? customType.trim() : beerType.trim();
      const res = await fetch("/api/host/admin/participant", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-host-pin": hostPin,
        },
        body: JSON.stringify({
          pin: participant.pin,
          nickname: nickname.trim() || null,
          beer_name: beerName.trim() || null,
          producer: producer.trim() || null,
          beer_type: typeValue || null,
          abv: abv.trim() ? Number(abv) : null,
          active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke lagre");
      setMessage("Lagret");
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("pin", participant.pin);
      body.append("file", file);
      const res = await fetch("/api/pin/beer-image", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Opplasting feilet");
      setImageUrl(data.beer_image_url || null);
      setMessage("Bilde oppdatert");
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    } finally {
      setBusy(false);
    }
  }

  async function clearImage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pin/beer-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: participant.pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke fjerne bilde");
      setImageUrl(null);
      setMessage("Bilde fjernet");
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    } finally {
      setBusy(false);
    }
  }

  const label = (participant.nickname || "").trim() || participant.pin;

  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left active:opacity-80"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-medium text-zinc-800">{label}</span>
          {participant.beer_name ? (
            <span className="text-zinc-500"> — {participant.beer_name}</span>
          ) : null}
          {!participant.active && (
            <span className="ml-1 text-[10px] uppercase text-zinc-400">inaktiv</span>
          )}
        </button>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs active:bg-zinc-50"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Lukk" : "Rediger"}
          </button>
          <button
            type="button"
            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            Slett
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          {error && (
            <div className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</div>
          )}
          {message && (
            <div className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
              {message}
            </div>
          )}

          <p className="text-[11px] text-zinc-500">PIN {participant.pin}</p>

          <label className="block text-xs text-zinc-600">
            Navn
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>

          <label className="block text-xs text-zinc-600">
            Ølnavn
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={beerName}
              onChange={(e) => setBeerName(e.target.value)}
            />
          </label>

          <label className="block text-xs text-zinc-600">
            Produsent
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={producer}
              onChange={(e) => setProducer(e.target.value)}
            />
          </label>

          <label className="block text-xs text-zinc-600">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={beerType}
              onChange={(e) => setBeerType(e.target.value)}
            >
              <option value="">Velg type</option>
              {BEER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__custom__">Annet (skriv selv)</option>
            </select>
          </label>
          {beerType === "__custom__" && (
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              placeholder="Egen type"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          )}

          <label className="block text-xs text-zinc-600">
            ABV %
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              inputMode="decimal"
              value={abv}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                const parts = val.split(".");
                setAbv(parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 1)}` : parts[0]);
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Aktiv i lobby
          </label>

          <div className="space-y-2 border-t border-zinc-200 pt-2">
            <p className="text-xs font-medium text-zinc-700">Ølbilde</p>
            {preview && (
              <img
                src={preview}
                alt=""
                className="mx-auto max-h-36 w-auto rounded-lg object-contain ring-1 ring-zinc-200"
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy}
              className="block w-full text-[11px] text-zinc-600 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-900 file:px-2 file:py-1.5 file:text-[11px] file:text-white"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadImage(f);
              }}
            />
            {imageUrl && (
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] active:bg-white disabled:opacity-60"
                onClick={clearImage}
              >
                Fjern opplastet bilde
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white active:opacity-90 disabled:opacity-60"
            onClick={save}
          >
            {busy ? "Lagrer…" : "Lagre endringer"}
          </button>
        </div>
      )}
    </li>
  );
}
