"use client";

import { useId, useState } from "react";
import type { Profile } from "@/lib/supabase/types";

/**
 * Campo de responsável: aceita tanto um membro cadastrado na plataforma (vira assignee_id)
 * quanto um nome livre (vira assignee_name) para pessoas que ainda não têm conta —
 * comum em dados migrados de planilha.
 */
export function AssigneeInput({
  profiles,
  assigneeId,
  assigneeName,
  onChange,
  className,
}: {
  profiles: Profile[];
  assigneeId: string | null;
  assigneeName: string | null;
  onChange: (value: { assigneeId: string | null; assigneeName: string | null }) => void;
  className?: string;
}) {
  const listId = useId();
  const currentProfile = profiles.find((p) => p.id === assigneeId);
  const [text, setText] = useState(currentProfile?.full_name || currentProfile?.email || assigneeName || "");

  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      onChange({ assigneeId: null, assigneeName: null });
      return;
    }
    const match = profiles.find(
      (p) => (p.full_name || p.email || "").toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      onChange({ assigneeId: match.id, assigneeName: null });
    } else {
      onChange({ assigneeId: null, assigneeName: trimmed });
    }
  }

  return (
    <>
      <input
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        placeholder="Nome do responsável"
        className={className}
      />
      <datalist id={listId}>
        {profiles.map((p) => (
          <option key={p.id} value={p.full_name || p.email || ""} />
        ))}
      </datalist>
    </>
  );
}
