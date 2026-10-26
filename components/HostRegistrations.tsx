"use client";

import { useCallback, useEffect, useState } from "react";

type Registration = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  bringing_beer: boolean | null;
  beer_note: string | null;
  message: string | null;
  invite_token: string;
  created_at: string;
};

type Props = {
  hostPin: string;
};

const statusLabel: Record<string, string> = {
  accepted: "Kommer",
  invited: "Invitert",
  declined: "Kan ikke",
  waitlist: "Venteliste",
  cancelled: "Avbestilt",
};

export default function HostRegistrations({ hostPin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [eventStatus, setEventStatus] = useState<string>("registration");
  const [regs, setRegs] = useState<Registration[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-host-pin": hostPin }),
    [hostPin],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/registrations", { headers: { "x-host-pin": hostPin } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke hente påmeldinger");
      setEventName(data.event?.name || "");
      setInviteCode(data.event?.invite_code || "");
      setRegistrationOpen(!!data.event?.registration_open);
      setEventStatus(data.event?.status || "registration");
      setRegs(data.registrations || []);
      setCounts(data.counts || {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    } finally {
      setLoading(false);
    }
  }, [hostPin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleRegistration() {
    setError(null);
    const res = await fetch("/api/host/events", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ registration_open: !registrationOpen }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Kunne ikke oppdatere");
      return;
    }
    setRegistrationOpen(!!data.event?.registration_open);
  }

  async function setLive() {
    setError(null);
    const res = await fetch("/api/host/events", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: "live", registration_open: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Kunne ikke sette live");
      return;
    }
    setEventStatus(data.event?.status || "live");
    setRegistrationOpen(!!data.event?.registration_open);
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    const res = await fetch("/api/host/registrations", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Kunne ikke oppdatere status");
      return;
    }
    await refresh();
  }

  async function createInvite() {
    setError(null);
    if (!inviteName.trim()) {
      setError("Navn er påkrevd for invitasjon");
      return;
    }
    const res = await fetch("/api/host/invites", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: inviteName.trim(),
        email: inviteEmail.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Kunne ikke opprette invitasjon");
      return;
    }
    setLastInviteUrl(data.invite_url || data.event_invite_url || null);
    setInviteName("");
    setInviteEmail("");
    await refresh();
  }

  const shareUrl =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/invitasjon/${encodeURIComponent(inviteCode)}`
      : inviteCode
        ? `/invitasjon/${encodeURIComponent(inviteCode)}`
        : "";

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Kunne ikke kopiere");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Invitasjon & påmelding</h3>
          <p className="text-xs text-zinc-500">
            {eventName || "Aktivt event"} · status: {eventStatus}
            {loading ? " …" : ""}
          </p>
        </div>
        <button
          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs active:bg-zinc-50"
          onClick={refresh}
        >
          Oppdater
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">
          Kommer: {counts.accepted ?? 0}
        </span>
        <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-800">
          Invitert: {counts.invited ?? 0}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
          Nei: {counts.declined ?? 0}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
          Venteliste: {counts.waitlist ?? 0}
        </span>
      </div>

      <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
        <p className="text-xs font-medium text-zinc-700">Del invitasjonslenke</p>
        <code className="block break-all text-[11px] text-zinc-600">{shareUrl || "—"}</code>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white"
            onClick={copyShare}
          >
            {copied ? "Kopiert!" : "Kopier lenke"}
          </button>
          <button
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
            onClick={toggleRegistration}
          >
            {registrationOpen ? "Steng påmelding" : "Åpne påmelding"}
          </button>
          <button
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white"
            onClick={setLive}
          >
            Sett event live
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">Invitasjonskode: {inviteCode || "—"}</p>
      </div>

      <div className="space-y-2 border-t border-zinc-100 pt-3">
        <p className="text-xs font-medium text-zinc-700">Personlig invitasjon</p>
        <input
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Navn"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="E-post (valgfritt)"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <button
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white"
          onClick={createInvite}
        >
          Opprett invitasjon
        </button>
        {lastInviteUrl && (
          <p className="break-all text-[11px] text-zinc-600">
            Personlig lenke:{" "}
            <a className="underline" href={lastInviteUrl}>
              {lastInviteUrl}
            </a>
          </p>
        )}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto border-t border-zinc-100 pt-3">
        {regs.length === 0 ? (
          <p className="text-xs text-zinc-500">Ingen påmeldinger ennå.</p>
        ) : (
          regs.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-800">{r.name}</div>
                  <div className="text-zinc-500">
                    {statusLabel[r.status] || r.status}
                    {r.bringing_beer ? " · tar med øl" : ""}
                    {r.beer_note ? ` (${r.beer_note})` : ""}
                  </div>
                  {(r.email || r.phone) && (
                    <div className="text-zinc-500">
                      {[r.email, r.phone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {r.message && (
                    <div className="mt-1 italic text-zinc-600">&ldquo;{r.message}&rdquo;</div>
                  )}
                </div>
                <select
                  className="rounded border border-zinc-300 bg-white px-1 py-0.5"
                  value={r.status}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
                >
                  <option value="accepted">Kommer</option>
                  <option value="invited">Invitert</option>
                  <option value="declined">Kan ikke</option>
                  <option value="waitlist">Venteliste</option>
                  <option value="cancelled">Avbestilt</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
