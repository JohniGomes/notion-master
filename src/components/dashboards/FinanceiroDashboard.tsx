"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
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
import type { Shop9Conta } from "@/lib/supabase/types";
import { useDateFilters } from "@/components/dashboards/DateFilters";
import { brl, brl2, C, DashTitle, Empty, MONTHS, Panel, StatCard } from "@/components/dashboards/theme";

const label = (v: unknown) => (Number(v) > 0 ? brl.format(Number(v)) : "");
const tooltipMoney = (v: unknown) => brl2.format(Number(v));
const trunc = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type Rank = { name: string; label: string; valor: number; pct: number };

// Cada linha pode render varias fatias (um recebimento reparte entre os servicos da venda).
function rankBy(
  rows: Shop9Conta[],
  total: number,
  slices: (c: Shop9Conta) => { name: string; share: number }[]
): Rank[] {
  const map = new Map<string, number>();
  for (const c of rows) {
    for (const s of slices(c)) map.set(s.name, (map.get(s.name) ?? 0) + c.valor_quitado * s.share);
  }
  return Array.from(map.entries())
    .map(([name, valor]) => ({
      name,
      label: trunc(name),
      valor,
      pct: total > 0 ? Math.round((valor / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

export function FinanceiroDashboard({ contas }: { contas: Shop9Conta[] }) {
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const c of contas) {
      if (c.data_quitacao) set.add(c.data_quitacao.slice(0, 4));
      if (c.data_vencimento) set.add(c.data_vencimento.slice(0, 4));
    }
    return Array.from(set).sort();
  }, [contas]);

  const defaultYear = useMemo(() => {
    const paidYears = contas.filter((c) => c.data_quitacao).map((c) => c.data_quitacao!.slice(0, 4));
    return paidYears.length ? paidYears.sort().at(-1) : undefined;
  }, [contas]);

  const { matches, ui } = useDateFilters(years, defaultYear);

  const data = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const paidOf = (pr: "P" | "R") =>
      contas.filter((c) => c.pagar_receber === pr && c.valor_quitado > 0 && matches(c.data_quitacao));
    const pendOf = (pr: "P" | "R") =>
      contas.filter((c) => c.pagar_receber === pr && c.valor_pendente > 0 && matches(c.data_vencimento));
    const sum = (rows: Shop9Conta[], f: (c: Shop9Conta) => number) => rows.reduce((s, c) => s + f(c), 0);

    const despPaga = paidOf("P");
    const despPagar = pendOf("P");
    const recebido = paidOf("R");
    const aReceber = pendOf("R");

    const monthly = MONTHS.map((m, i) => {
      const at = (rows: Shop9Conta[], dateOf: (c: Shop9Conta) => string | null, f: (c: Shop9Conta) => number) =>
        sum(
          rows.filter((c) => Number(dateOf(c)?.slice(5, 7)) === i + 1),
          f
        );
      return {
        mes: m,
        pagas: at(despPaga, (c) => c.data_quitacao, (c) => c.valor_quitado),
        aPagar: at(despPagar, (c) => c.data_vencimento, (c) => c.valor_pendente),
        recebido: at(recebido, (c) => c.data_quitacao, (c) => c.valor_quitado),
        aReceber: at(aReceber, (c) => c.data_vencimento, (c) => c.valor_pendente),
      };
    });

    const totalDespPaga = sum(despPaga, (c) => c.valor_quitado);
    const totalDespPagar = sum(despPagar, (c) => c.valor_pendente);
    const totalRecebido = sum(recebido, (c) => c.valor_quitado);
    const totalAReceber = sum(aReceber, (c) => c.valor_pendente);
    const atraso = sum(
      aReceber.filter((c) => (c.data_vencimento ?? "") < today),
      (c) => c.valor_pendente
    );
    const margem = totalRecebido - totalDespPaga;
    const provisao = totalAReceber - totalDespPagar;

    return {
      monthly,
      totalDespPaga,
      totalDespPagar,
      totalRecebido,
      totalAReceber,
      atraso,
      margem,
      margemPct: totalDespPaga > 0 ? (margem / totalDespPaga) * 100 : 0,
      provisao,
      provisaoPct: totalDespPagar > 0 ? (provisao / totalDespPagar) * 100 : 0,
      rankDesp: rankBy(despPaga, totalDespPaga, (c) => [
        { name: c.plano_codigo != null ? `${c.plano_codigo} - ${c.plano_nome ?? ""}` : "Sem conta", share: 1 },
      ]),
      rankRec: rankBy(recebido, totalRecebido, (c) =>
        c.servicos && c.servicos.length > 0
          ? c.servicos.map((s) => ({ name: s.n, share: s.f }))
          : [{ name: "Outros (reembolsos, saldos)", share: 1 }]
      ),
    };
  }, [contas, matches]);

  const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;
  const sign = (v: number) => (v >= 0 ? C.green : C.red);

  return (
    <div className="space-y-6 rounded-2xl p-4 sm:p-6" style={{ background: C.cream }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashTitle name="Financeiro" />
        <div className="w-full max-w-xl">{ui}</div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Despesa Paga" value={brl2.format(data.totalDespPaga)}>
          <div className="flex justify-end gap-2">
            <span className="font-semibold text-neutral-800">A Pagar</span>
            <span style={{ color: C.red }}>{brl2.format(data.totalDespPagar)}</span>
          </div>
        </StatCard>
        <StatCard label="Recebido" value={brl2.format(data.totalRecebido)}>
          <div className="flex justify-between gap-2">
            <span>
              <span className="font-semibold text-neutral-800">Atraso </span>
              <span style={{ color: C.red }}>{brl2.format(data.atraso)}</span>
            </span>
            <span>
              <span className="font-semibold text-neutral-800">A Receber </span>
              <span style={{ color: C.green }}>{brl2.format(data.totalAReceber)}</span>
            </span>
          </div>
        </StatCard>
        <StatCard label="Margem de Lucro" value={brl2.format(data.margem)} valueColor={sign(data.margem)}>
          <div className="flex justify-end gap-2">
            <span className="font-semibold text-neutral-800">Provisão</span>
            <span style={{ color: sign(data.provisao) }}>{brl2.format(data.provisao)}</span>
          </div>
        </StatCard>
        <StatCard label="Margem %" value={pct(data.margemPct)} valueColor={sign(data.margem)}>
          <div className="flex justify-end gap-2">
            <span className="font-semibold text-neutral-800">Provisão</span>
            <span style={{ color: sign(data.provisao) }}>{pct(data.provisaoPct)}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Despesas">
          <MonthBars data={data.monthly} a="pagas" aName="Pagas" b="aPagar" bName="A Pagar" />
        </Panel>
        <Panel title="Receitas">
          <MonthBars data={data.monthly} a="recebido" aName="Recebido" b="aReceber" bName="A Receber" />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ranking Despesas">
          <RankChart data={data.rankDesp} />
        </Panel>
        <Panel title="Ranking Receitas">
          <RankChart data={data.rankRec} />
        </Panel>
      </div>
    </div>
  );
}

function MonthBars({
  data,
  a,
  aName,
  b,
  bName,
}: {
  data: Record<string, number | string>[];
  a: string;
  aName: string;
  b: string;
  bName: string;
}) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece7da" />
          <XAxis dataKey="mes" fontSize={11} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={tooltipMoney} />
          <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey={b} name={bName} fill={C.beige} radius={[3, 3, 0, 0]}>
            <LabelList dataKey={b} position="top" formatter={label} fontSize={8} />
          </Bar>
          <Bar dataKey={a} name={aName} fill={C.brown} radius={[3, 3, 0, 0]}>
            <LabelList dataKey={a} position="top" formatter={label} fontSize={8} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankChart({ data }: { data: Rank[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 12, left: 40, bottom: 0 }}>
          <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={78} fontSize={9} tickLine={false} />
          <YAxis yAxisId="valor" hide />
          <YAxis yAxisId="pct" hide orientation="right" />
          <Tooltip
            formatter={(v, name) => (name === "%" ? `${v}%` : tooltipMoney(v))}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.name ?? "")}
          />
          <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="valor" dataKey="valor" name="Valor" fill={C.brown} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="valor" position="top" formatter={label} fontSize={9} />
          </Bar>
          <Line yAxisId="pct" dataKey="pct" name="%" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }}>
            <LabelList dataKey="pct" position="top" formatter={(v: unknown) => `${String(v).replace(".", ",")}%`} fontSize={9} fill={C.gold} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
