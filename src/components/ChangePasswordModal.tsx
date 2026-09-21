"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("saved");
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Redefinir senha</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        {status === "saved" ? (
          <p className="text-sm text-green-600">Senha atualizada com sucesso!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-md bg-neutral-900 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {status === "saving" ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
