import Link from "next/link";
import InvitePage from "@/components/InvitePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invitasjon – Gulmasse '26",
  description: "Velkommen til Gulmasse '26! Meld deg på juleøl-eventet.",
};

export default function InviteRoutePage() {
  return (
    <div className="min-h-dvh w-full bg-transparent text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Gulmasse &apos;26</h1>
          <Link href="/" className="text-sm text-blue-600 underline">
            App
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <InvitePage />
      </main>
    </div>
  );
}
