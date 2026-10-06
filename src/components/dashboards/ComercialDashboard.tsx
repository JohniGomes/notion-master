"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Nomes dos tipos de O.S no Shop9 (Configuracoes_Ordem_Servico_Tipos).
const TIPO_ORCAMENTO = "Orçamento";
const TIPO_APROVADO = "Contratado";
const TIPO_NAO_APROVADO = "Não Aprovado";

export function ComercialDashboard({
  os,
  itens,
  situacoes,
  tipos,
}: {
  os: Shop9Os[];
  itens: Shop9OsItem[];
  situacoes: Shop9Lookup[];
  tipos: Shop9Lookup[];
}) {
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");

  const years = useMemo(
    () =>
      Array.from(new Set(os.map((o) => o.data_gravacao?.slice(0, 4)).filter((y): y is string => !!y))).sort(),
    [os]
  );

  const filtered = useMemo(
    () =>
      os.filter((o) => {
        if (year !== "all" && o.data_gravacao?.slice(0, 4) !== year) return false;
        if (month !== "all" && o.data_gravacao?.slice(5, 7) !== month) return false;
        return true;
      }),
    [os, year, month]
  );

  const tipoNome = useMemo(() => new Map(tipos.map((t) => [t.ordem, t.nome])), [tipos]);
  const situacaoNome = useMemo(() => new Map(situacoes.map((s) => [s.ordem, s.nome])), [situacoes]);

  const kpis = useMemo(() => {
    const by = (nome: string) => {
      const list = filtered.filter((o) => tipoNome.get(o.tipo_ordem ?? -1) === nome);
      return { qtd: list.length, valor: list.reduce((s, o) => s + o.valor_total, 0) };
    };
    const total = { qtd: filtered.length, valor: filtered.reduce((s, o) => s + o.valor_total, 0) };
    const aprovado = by(TIPO_APROVADO);
    return {
      total,
      aprovado,
      orcamento: by(TIPO_ORCAMENTO),
      naoAprovado: by(TIPO_NAO_APROVADO),
      ticket: aprovado.qtd > 0 ? aprovado.valor / aprovado.qtd : 0,
      clientes: new Set(filtered.map((o) => o.cliente).filter(Boolean)).size,
    };
  }, [filtered, tipoNome]);

  const bySituacao = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const o of filtered) {
      const nome = situacaoNome.get(o.situacao_ordem ?? -1) ?? "Sem situação";
      const cur = map.get(nome) ?? { nome, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += o.valor_total;
      map.set(nome, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [filtered, situacaoNome]);

  const byServico = useMemo(() => {
    const movimentos = new Set(filtered.map((o) => o.ordem_movimento));
    const map = new Map<string, { nome: string; valor: number; qtd: number }>();
    for (const i of itens) {
      if (!movimentos.has(i.ordem_movimento) || !i.servico_nome) continue;
      const cur = map.get(i.servico_nome) ?? { nome: i.servico_nome, valor: 0, qtd: 0 };
      cur.valor += i.preco_final;
      cur.qtd += 1;
      map.set(i.servico_nome, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered, itens]);

  const byCliente = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; qtd: number }>();
    for (const o of filtered) {
      const nome = o.cliente || "Sem cliente";
      const cur = map.get(nome) ?? { nome, valor: 0, qtd: 0 };
      cur.valor += o.valor_total;
      cur.qtd += 1;
      map.set(nome, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);
  }, [filtered]);

  const pct = (part: number) => (kpis.total.qtd > 0 ? `${((part / kpis.total.qtd) * 100).toFixed(1)}%` : "—");

  return (
    <div className="px-6 pb-10 pt-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Dashboard Comercial</h2>
        <div className="ml-auto flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="all">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="all">Todos os meses</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total de O.S" value={brl.format(kpis.total.valor)} sub={`${kpis.total.qtd} O.S`} />
        <Kpi
          label="Contratado"
          value={brl.format(kpis.aprovado.valor)}
          sub={`${kpis.aprovado.qtd} O.S · ${pct(kpis.aprovado.qtd)}`}
          tone="green"
        />
        <Kpi
          label="Em orçamento"
          value={brl.format(kpis.orcamento.valor)}
          sub={`${kpis.orcamento.qtd} O.S · ${pct(kpis.orcamento.qtd)}`}
        />
        <Kpi
          label="Não aprovado"
          value={brl.format(kpis.naoAprovado.valor)}
          sub={`${kpis.naoAprovado.qtd} O.S · ${pct(kpis.naoAprovado.qtd)}`}
          tone="red"
        />
        <Kpi label="Ticket médio" value={brl.format(kpis.ticket)} sub={`${kpis.clientes} clientes`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Situação das O.S (valor)">
          <BarList data={bySituacao} />
        </Panel>
        <Panel title="Serviços por valor (top 10)">
          <BarList data={byServico} />
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="O.S por cliente (top 15 por valor)">
          <BarList data={byCliente} />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={
          "mt-1 text-xl font-semibold " +
          (tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-neutral-900")
        }
      >
        {value}
      </div>
      <div className="text-xs text-neutral-500">{sub}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h3>
      {children}
    </div>
  );
}

function BarList({ data }: { data: { nome: string; valor: number; qtd: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-neutral-400">Sem dados no período.</p>;
  return (
    <div style={{ height: Math.max(220, data.length * 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid horizontal={false} stroke="#eee" />
          <XAxis type="number" tickFormatter={(v) => brl.format(Number(v))} fontSize={11} />
          <YAxis type="category" dataKey="nome" width={190} fontSize={11} interval={0} />
          <Tooltip
            formatter={(value) => brl.format(Number(value))}
            labelFormatter={(label) => {
              const row = data.find((d) => d.nome === label);
              return row ? `${label} (${row.qtd} O.S)` : String(label);
            }}
          />
          <Bar dataKey="valor" fill="#404040" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
