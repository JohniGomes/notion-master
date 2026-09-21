"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotStatus("sending");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setForgotStatus(error ? "error" : "sent");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <Image src="/logo.png" alt="Master Regularização Imobiliária" width={140} height={140} className="mx-auto mb-4 h-auto w-32" priority />
        <h1 className="mb-1 text-center text-xl font-semibold text-neutral-900">Gestão de Tarefas da Master</h1>

        {forgotMode ? (
          <>
            <p className="mb-6 text-center text-sm text-neutral-500">
              Digite seu e-mail e enviaremos um link para redefinir a senha.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              {forgotStatus === "sent" && (
                <p className="text-sm text-green-600">Link enviado! Confira seu e-mail.</p>
              )}
              {forgotStatus === "error" && (
                <p className="text-sm text-red-600">Não foi possível enviar. Confira o e-mail digitado.</p>
              )}

              <button
                type="submit"
                disabled={forgotStatus === "sending"}
                className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {forgotStatus === "sending" ? "Enviando..." : "Enviar link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setForgotStatus("idle");
                }}
                className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
              >
                Voltar para o login
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-neutral-500">Entre com sua conta da equipe.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
              >
                Esqueci minha senha
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
