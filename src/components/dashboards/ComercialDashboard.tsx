"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";
import { useDateFilters } from "@/components/dashboards/DateFilters";
import { brl, brl2, C, DashTitle, Empty, Panel, StatCard } from "@/components/dashboards/theme";

// Nomes dos tipos de O.S no Shop9 (Configuracoes_Ordem_Servico_Tipos).
const TIPO_ORCAMENTO = "Orçamento";
const TIPO_APROVADO = "Contratado";
const TIPO_NAO_APROVADO = "Não Aprovado";

const label = (v: unknown) => (Number(v) > 0 ? brl.format(Number(v)) : "");
const trunc = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type Bucket = { name: string; label: string; valor: number; qtd: number };

function top(map: Map<string, { valor: number; qtd: number }>, n: number): Bucket[] {
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, label: trunc(name), ...v }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);
}

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
  const years = useMemo(
    () =>
      Array.from(new Set(os.map((o) => o.data_gravacao?.slice(0, 4)).filter((y): y is string => !!y))).sort(),
    [os]
  );
  const { matches, ui } = useDateFilters(years, years.at(-1));

  const filtered = useMemo(() => os.filter((o) => matches(o.data_gravacao)), [os, matches]);
  const tipoNome = useMemo(() => new Map(tipos.map((t) => [t.ordem, t.nome])), [tipos]);
  const situacaoNome = useMemo(() => new Map(situacoes.map((s) => [s.ordem, s.nome])), [situacoes]);

  const kpis = useMemo(() => {
    const by = (nome: string) => {
      const list = filtered.filter((o) => tipoNome.get(o.tipo_ordem ?? -1) === nome);
      return { qtd: list.length, valor: list.reduce((s, o) => s + o.valor_total, 0) };
    };
    const orcado = { qtd: filtered.length, valor: filtered.reduce((s, o) => s + o.valor_total, 0) };
    const clientes = new Set(filtered.map((o) => o.cliente).filter(Boolean)).size;
    return {
      orcado,
      aprovado: by(TIPO_APROVADO),
      emAprovacao: by(TIPO_ORCAMENTO),
      naoAprovado: by(TIPO_NAO_APROVADO),
      clientes,
      ticket: clientes > 0 ? orcado.valor / clientes : 0,
    };
  }, [filtered, tipoNome]);

  const bySituacao = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    for (const o of filtered) {
      const nome = situacaoNome.get(o.situacao_ordem ?? -1) ?? "Sem situação";
      const cur = map.get(nome) ?? { valor: 0, qtd: 0 };
      cur.valor += o.valor_total;
      cur.qtd += 1;
      map.set(nome, cur);
    }
    return top(map, 12);
  }, [filtered, situacaoNome]);

  const byServico = useMemo(() => {
    const movimentos = new Set(filtered.map((o) => o.ordem_movimento));
    const map = new Map<string, { valor: number; qtd: number }>();
    for (const i of itens) {
      if (!movimentos.has(i.ordem_movimento) || !i.servico_nome) continue;
      const cur = map.get(i.servico_nome) ?? { valor: 0, qtd: 0 };
      cur.valor += i.preco_final;
      cur.qtd += 1;
      map.set(i.servico_nome, cur);
    }
    return top(map, 10);
  }, [filtered, itens]);

  const byCliente = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    for (const o of filtered) {
      const nome = o.cliente || "Sem cliente";
      const cur = map.get(nome) ?? { valor: 0, qtd: 0 };
      cur.valor += o.valor_total;
      cur.qtd += 1;
      map.set(nome, cur);
    }
    return top(map, 15);
  }, [filtered]);

  const pct = (part: number) =>
    kpis.orcado.qtd > 0 ? `${((part / kpis.orcado.qtd) * 100).toFixed(2).replace(".", ",")}%` : "—";

  return (
    <div className="space-y-6 rounded-2xl p-4 sm:p-6" style={{ background: C.cream }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashTitle name="Comercial" />
        <div className="w-full max-w-xl">{ui}</div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orçado" value={brl.format(kpis.orcado.valor)}>
          <div className="font-semibold text-neutral-800">{kpis.orcado.qtd} O.S</div>
          <div className="mt-0.5">
            <span className="font-semibold text-neutral-800">Não aprovado </span>
            <span style={{ color: C.red }}>
              {kpis.naoAprovado.qtd} · {brl.format(kpis.naoAprovado.valor)}
            </span>
          </div>
        </StatCard>
        <StatCard label="Aprovado" value={brl.format(kpis.aprovado.valor)}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">{kpis.aprovado.qtd} O.S</span>
            <span style={{ color: C.green }}>{pct(kpis.aprovado.qtd)}</span>
          </div>
        </StatCard>
        <StatCard label="Em Aprovação" value={brl.format(kpis.emAprovacao.valor)}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">{kpis.emAprovacao.qtd} O.S</span>
            <span style={{ color: C.green }}>{pct(kpis.emAprovacao.qtd)}</span>
          </div>
        </StatCard>
        <StatCard label="Ticket Médio" value={brl.format(kpis.ticket)}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">Qtd Clientes</span>
            <span style={{ color: C.green }}>{kpis.clientes}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Situação O.S">
          <ValueQtyChart data={bySituacao} />
        </Panel>
        <Panel title="Tipo de O.S">
          <ValueQtyChart data={byServico} showQty={false} />
        </Panel>
      </div>
      <Panel title="O.S por Cliente">
        <ValueQtyChart data={byCliente} height={360} />
      </Panel>
    </div>
  );
}

function ValueQtyChart({
  data,
  showQty = true,
  height = 320,
}: {
  data: Bucket[];
  showQty?: boolean;
  height?: number;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 12, left: 40, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece7da" />
          <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={84} fontSize={9} tickLine={false} />
          <YAxis yAxisId="valor" hide />
          <YAxis yAxisId="qtd" hide orientation="right" />
          <Tooltip
            formatter={(v, name) => (name === "Qtd O.S" ? String(v) : brl2.format(Number(v)))}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.name ?? "")}
          />
          <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="valor" dataKey="valor" name="R$" fill={C.brown} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="valor" position="top" formatter={label} fontSize={9} />
          </Bar>
          {showQty && (
            <Line yAxisId="qtd" dataKey="qtd" name="Qtd O.S" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }}>
              <LabelList dataKey="qtd" position="top" fontSize={9} fill={C.gold} />
            </Line>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
