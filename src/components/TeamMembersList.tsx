"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileName } from "@/lib/data/profiles";
import type { Profile } from "@/lib/supabase/types";

export function TeamMembersList({ initialProfiles }: { initialProfiles: Profile[] }) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setDraftName(profile.full_name ?? "");
  }

  async function saveEdit(id: string) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name) return;
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, full_name: name } : p)));
    await updateProfileName(supabase, id, name);
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {profiles.map((p) => (
        <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
          {editingId === p.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(p.id);
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => saveEdit(p.id)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
              />
              <button type="submit" className="text-neutral-400 hover:text-neutral-700">
                <Check size={14} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => startEdit(p)}
              className="group flex items-center gap-1.5 font-medium text-neutral-800 hover:text-neutral-900"
            >
              {p.full_name || "Sem nome"}
              <Pencil size={12} className="text-neutral-300 opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <span className="text-neutral-500">{p.email}</span>
        </li>
      ))}
    </ul>
  );
}
