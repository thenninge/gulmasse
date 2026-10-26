"use client";

import Link from "next/link";
import { use } from "react";
import InviteRegistration from "@/components/InviteRegistration";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default function InvitasjonPage({ params, searchParams }: Props) {
  const { code } = use(params);
  const { token } = use(searchParams);

  return (
    <div className="min-h-dvh w-full bg-transparent text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Gulmasse – invitasjon</h1>
          <Link href="/" className="text-sm text-blue-600 underline">
            App
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <InviteRegistration code={decodeURIComponent(code)} token={token || null} />
      </main>
    </div>
  );
}
