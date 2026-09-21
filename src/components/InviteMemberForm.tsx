"use client";

import { useState } from "react";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStatus("sent");
      setEmail("");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Não foi possível enviar o convite.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@exemplo.com"
        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {status === "loading" ? "Enviando..." : "Convidar"}
      </button>
      {status === "sent" && <span className="text-sm text-green-600">Convite enviado!</span>}
      {status === "error" && <span className="text-sm text-red-600">{errorMsg}</span>}
    </form>
  );
}
