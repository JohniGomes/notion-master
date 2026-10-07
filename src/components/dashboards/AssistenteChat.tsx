"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/components/dashboards/theme";
import { Markdown } from "@/components/dashboards/Markdown";

type Msg = { role: "user" | "model"; text: string; tools?: string[] };

const TOOL_LABEL: Record<string, string> = {
  resumo_mes: "resumo do mês",
  comparar_meses: "comparação de meses",
  projecao_mes_atual: "projeção do mês",
  previsao_caixa: "previsão de caixa",
  servicos_orcado_vs_recebido: "serviços: orçado × recebido",
  equipe_status: "status da equipe",
};

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function AssistenteChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const now = new Date();
    const atual = MONTH_NAMES[now.getMonth()];
    const passado = MONTH_NAMES[(now.getMonth() + 11) % 12];
    return [
      `Como foi o mês de ${passado}? Pontos positivos, pontos de atenção, comparação com os meses anteriores e uma recomendação.`,
      `Como está ${atual} até agora e qual a projeção para fechar o mês?`,
      "Previsão de caixa para os próximos 90 dias.",
      "Compare os últimos 3 meses: despesa, receita e margem.",
      "Quais serviços mais contrataram e mais geraram receita este ano? Compare orçado, contratado e recebido.",
      "Como está a equipe? Quem tem mais etapas em aberto?",
    ];
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })) }),
      });
      const json = (await res.json().catch(() => ({}))) as { reply?: string; toolsUsed?: string[]; error?: string };
      if (!res.ok || !json.reply) throw new Error(json.error ?? "Não foi possível obter a resposta.");
      setMessages([...next, { role: "model", text: json.reply, tools: Array.from(new Set(json.toolsUsed ?? [])) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar o assistente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl p-4 sm:p-5" style={{ background: C.cream }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-light tracking-wide" style={{ color: C.ink }}>
          ASSISTENTE <span className="mx-1 font-extralight">|</span>
          <span className="font-normal">ANÁLISE COM IA</span>
        </h2>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setError("");
            }}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{ background: C.tan, color: C.ink }}
          >
            Nova conversa
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-md">
        <div className="max-h-[560px] min-h-[220px] space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div>
              <p className="mb-3 text-sm text-neutral-600">
                Pergunte sobre o financeiro, o comercial e a equipe. As respostas usam os números do Shop9 (somente totais,
                sem nomes de clientes ou fornecedores).
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full px-3 py-1.5 text-left text-xs font-medium transition hover:opacity-80"
                    style={{ background: C.tan, color: C.ink }}
                  >
                    {s.length > 70 ? `${s.slice(0, 68)}…` : s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white" style={{ background: C.brown }}>
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div
                  className="max-w-[92%] rounded-2xl rounded-bl-sm border px-3 py-2"
                  style={{ borderColor: C.tan, background: "#FBF9F4", color: C.ink }}
                >
                  <Markdown text={m.text} />
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 text-[10px] uppercase tracking-wide text-neutral-400">
                      Consultou: {m.tools.map((t) => TOOL_LABEL[t] ?? t).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border px-3 py-2 text-sm text-neutral-500" style={{ borderColor: C.tan }}>
                Analisando os números…
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: `${C.red}14`, color: C.red }}>
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length > 0 && !loading && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: C.cream, color: C.brown, border: `1px solid ${C.tan}` }}
              >
                {s.length > 48 ? `${s.slice(0, 46)}…` : s}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1500}
            placeholder="Pergunte algo, por exemplo: Como foi o mês de setembro?"
            className="min-h-[40px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: C.tan }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: C.brown }}
          >
            Enviar
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-400">
          Respostas geradas por IA a partir dos totais do Shop9. Projeções são estimativas; confira valores importantes.
        </p>
      </div>
    </div>
  );
}
