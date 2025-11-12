"use client";

import { useState } from "react";
import PickerWheel, { Participant } from "@/components/PickerWheel";

export default function DemoPickerPage() {
  const [people, setPeople] = useState<Participant[]>([
    { id: "1", name: "Tomasdah", selected: false },
    { id: "2", name: "Kjon2", selected: false },
    { id: "3", name: "Bossman", selected: true },
    { id: "4", name: "Clarissa", selected: false },
    { id: "5", name: "Morten", selected: false },
  ]);

  return (
    <div className="min-h-dvh w-full bg-white text-zinc-900">
      <header className="sticky top-0 border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-lg font-semibold">PickerWheel demo</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <PickerWheel
          participants={people}
          onPick={(p) => setPeople((ps) => ps.map((x) => (x.id === p.id ? { ...x, selected: true } : x)))}
        />
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Data</h2>
          <ul className="text-sm">
            {people.map((p) => (
              <li key={p.id}>
                {p.name} — {p.selected ? "selected" : "available"}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}


