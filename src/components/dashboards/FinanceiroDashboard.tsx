"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Shop9Conta } from "@/lib/supabase/types";
import { useDateFilters } from "@/components/dashboards/DateFilters";
import { ComboChart } from "@/components/dashboards/ComboChart";
import { brl, brl2, C, DashHeader, Delta, MONTHS, Panel, StatCard } from "@/components/dashboards/theme";

const label = (v: unknown) => (Number(v) > 0 ? brl.format(Number(v)) : "");
const tooltipMoney = (v: unknown) => brl2.format(Number(v));
const trunc = (s: string, n = 20) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

// Totais dos cartoes para um periodo qualquer (usado na comparacao com o mes anterior).
function totalsFor(contas: Shop9Conta[], inPeriod: (iso: string | null) => boolean) {
  let despPaga = 0;
  let recebido = 0;
  for (const c of contas) {
    if (c.valor_quitado > 0 && inPeriod(c.data_quitacao)) {
      if (c.pagar_receber === "P") despPaga += c.valor_quitado;
      else recebido += c.valor_quitado;
    }
  }
  const margem = recebido - despPaga;
  return { despPaga, recebido, margem, margemPct: despPaga > 0 ? (margem / despPaga) * 100 : 0 };
}

type Kind = "paga" | "atraso" | "avencer";
type Entry = {
  id: string;
  date: string;
  kind: Kind;
  descricao: string;
  parceiro: string;
  conta: string;
  valor: number;
};

type PanelKey = "desp" | "rec";

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

  const { matches, ui, previous, selectedYears } = useDateFilters(years, defaultYear);
  const [open, setOpen] = useState<{ panel: PanelKey; month: number } | null>(null);

  const data = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const paidOf = (pr: "P" | "R") =>
      contas.filter((c) => c.pagar_receber === pr && c.valor_quitado > 0 && matches(c.data_quitacao));
    const pendOf = (pr: "P" | "R") =>
      contas.filter((c) => c.pagar_receber === pr && c.valor_pendente > 0 && matches(c.data_vencimento));
    const sum = (rows: Shop9Conta[], f: (c: Shop9Conta) => number) => rows.reduce((s, c) => s + f(c), 0);
    const overdue = (c: Shop9Conta) => (c.data_vencimento ?? "") < today;

    const despPaga = paidOf("P");
    const despPagar = pendOf("P");
    const recebido = paidOf("R");
    const aReceber = pendOf("R");

    const monthly = MONTHS.map((m, i) => {
      const inMonth = (iso: string | null) => Number(iso?.slice(5, 7)) === i + 1;
      const paid = (rows: Shop9Conta[]) => sum(rows.filter((c) => inMonth(c.data_quitacao)), (c) => c.valor_quitado);
      const pend = (rows: Shop9Conta[], late: boolean) =>
        sum(
          rows.filter((c) => inMonth(c.data_vencimento) && overdue(c) === late),
          (c) => c.valor_pendente
        );
      const pagarAtraso = pend(despPagar, true);
      const pagarAvencer = pend(despPagar, false);
      const receberAtraso = pend(aReceber, true);
      const receberAvencer = pend(aReceber, false);
      return {
        mes: m,
        pagas: paid(despPaga),
        pagarAtraso,
        pagarAvencer,
        pagarTotal: pagarAtraso + pagarAvencer,
        recebido: paid(recebido),
        receberAtraso,
        receberAvencer,
        receberTotal: receberAtraso + receberAvencer,
      };
    });

    const totalDespPaga = sum(despPaga, (c) => c.valor_quitado);
    const totalRecebido = sum(recebido, (c) => c.valor_quitado);
    const pagarAtraso = sum(despPagar.filter(overdue), (c) => c.valor_pendente);
    const pagarAvencer = sum(despPagar.filter((c) => !overdue(c)), (c) => c.valor_pendente);
    const receberAtraso = sum(aReceber.filter(overdue), (c) => c.valor_pendente);
    const receberAvencer = sum(aReceber.filter((c) => !overdue(c)), (c) => c.valor_pendente);
    const totalAPagar = pagarAtraso + pagarAvencer;
    const totalAReceber = receberAtraso + receberAvencer;
    const margem = totalRecebido - totalDespPaga;
    const provisao = totalAReceber - totalAPagar;

    const entry = (c: Shop9Conta, kind: Kind, date: string | null, valor: number, conta: string): Entry => ({
      id: `${c.ordem}-${kind}`,
      date: date ?? "",
      kind,
      descricao: c.descricao ?? "",
      parceiro: c.parceiro ?? "",
      conta,
      valor,
    });
    const despConta = (c: Shop9Conta) => (c.plano_codigo != null ? `${c.plano_codigo} - ${c.plano_nome ?? ""}` : "—");
    const recConta = (c: Shop9Conta) =>
      c.servicos && c.servicos.length > 0 ? c.servicos.map((s) => s.n).join(", ") : c.plano_nome || "—";
    const entries = (paid: Shop9Conta[], pend: Shop9Conta[], contaOf: (c: Shop9Conta) => string): Entry[] => [
      ...paid.map((c) => entry(c, "paga", c.data_quitacao, c.valor_quitado, contaOf(c))),
      ...pend.map((c) => entry(c, overdue(c) ? "atraso" : "avencer", c.data_vencimento, c.valor_pendente, contaOf(c))),
    ];

    return {
      monthly,
      totalDespPaga,
      totalRecebido,
      pagarAtraso,
      pagarAvencer,
      receberAtraso,
      receberAvencer,
      margem,
      margemPct: totalDespPaga > 0 ? (margem / totalDespPaga) * 100 : 0,
      provisao,
      provisaoPct: totalAPagar > 0 ? (provisao / totalAPagar) * 100 : 0,
      despEntries: entries(despPaga, despPagar, despConta),
      recEntries: entries(recebido, aReceber, recConta),
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

  const prev = useMemo(() => (previous ? totalsFor(contas, previous.matches) : null), [contas, previous]);

  const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;
  const sign = (v: number) => (v >= 0 ? C.green : C.red);

  function pick(panel: PanelKey, month: number) {
    setOpen((cur) => (cur && cur.panel === panel && cur.month === month ? null : { panel, month }));
  }

  const monthTitle = (month: number) =>
    selectedYears.size === 1
      ? `${MONTH_NAMES[month]}/${Array.from(selectedYears)[0]}`
      : `${MONTH_NAMES[month]} (anos filtrados)`;

  return (
    <div className="space-y-5 rounded-2xl p-4 sm:p-5" style={{ background: C.cream }}>
      <DashHeader name="Financeiro">{ui}</DashHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Despesa Paga"
          value={brl2.format(data.totalDespPaga)}
          delta={
            prev && previous && (
              <Delta current={data.totalDespPaga} previous={prev.despPaga} label={previous.label} format={brl2.format} inverse />
            )
          }
        >
          <div className="flex justify-between gap-2">
            <span>
              <span className="font-semibold text-neutral-800">Atraso </span>
              <span style={{ color: C.red }}>{brl2.format(data.pagarAtraso)}</span>
            </span>
            <span>
              <span className="font-semibold text-neutral-800">A Pagar </span>
              <span style={{ color: C.green }}>{brl2.format(data.pagarAvencer)}</span>
            </span>
          </div>
        </StatCard>
        <StatCard
          label="Recebido"
          value={brl2.format(data.totalRecebido)}
          delta={
            prev && previous && (
              <Delta current={data.totalRecebido} previous={prev.recebido} label={previous.label} format={brl2.format} />
            )
          }
        >
          <div className="flex justify-between gap-2">
            <span>
              <span className="font-semibold text-neutral-800">Atraso </span>
              <span style={{ color: C.red }}>{brl2.format(data.receberAtraso)}</span>
            </span>
            <span>
              <span className="font-semibold text-neutral-800">A Receber </span>
              <span style={{ color: C.green }}>{brl2.format(data.receberAvencer)}</span>
            </span>
          </div>
        </StatCard>
        <StatCard
          label="Margem de Lucro"
          value={brl2.format(data.margem)}
          valueColor={sign(data.margem)}
          delta={
            prev && previous && (
              <Delta current={data.margem} previous={prev.margem} label={previous.label} format={brl2.format} mode="abs" />
            )
          }
        >
          <div className="flex justify-end gap-2">
            <span className="font-semibold text-neutral-800">Provisão</span>
            <span style={{ color: sign(data.provisao) }}>{brl2.format(data.provisao)}</span>
          </div>
        </StatCard>
        <StatCard
          label="Margem %"
          value={pct(data.margemPct)}
          valueColor={sign(data.margem)}
          delta={
            prev && previous && (
              <Delta current={data.margemPct} previous={prev.margemPct} label={previous.label} format={pct} mode="pp" />
            )
          }
        >
          <div className="flex justify-end gap-2">
            <span className="font-semibold text-neutral-800">Provisão</span>
            <span style={{ color: sign(data.provisao) }}>{pct(data.provisaoPct)}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Despesas"
          legend={[
            { color: C.overdue, label: "Em atraso" },
            { color: C.beige, label: "A Pagar" },
            { color: C.brown, label: "Pagas" },
          ]}
        >
          <MonthBars
            data={data.monthly}
            keys={{ paid: "pagas", late: "pagarAtraso", soon: "pagarAvencer", total: "pagarTotal" }}
            names={{ paid: "Pagas", soon: "A Pagar" }}
            openMonth={open?.panel === "desp" ? open.month : null}
            onPick={(m) => pick("desp", m)}
          />
        </Panel>
        <Panel
          title="Receitas"
          legend={[
            { color: C.overdue, label: "Em atraso" },
            { color: C.beige, label: "A Receber" },
            { color: C.brown, label: "Recebido" },
          ]}
        >
          <MonthBars
            data={data.monthly}
            keys={{ paid: "recebido", late: "receberAtraso", soon: "receberAvencer", total: "receberTotal" }}
            names={{ paid: "Recebido", soon: "A Receber" }}
            openMonth={open?.panel === "rec" ? open.month : null}
            onPick={(m) => pick("rec", m)}
          />
        </Panel>
      </div>

      {open && (
        <MonthDetails
          title={`${open.panel === "desp" ? "Despesas" : "Receitas"} · ${monthTitle(open.month)}`}
          month={open.month}
          entries={open.panel === "desp" ? data.despEntries : data.recEntries}
          partnerLabel={open.panel === "desp" ? "Fornecedor" : "Cliente"}
          labels={open.panel === "desp" ? { paid: "Paga", soon: "A pagar" } : { paid: "Recebida", soon: "A receber" }}
          onClose={() => setOpen(null)}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Ranking Despesas"
          legend={[
            { color: C.brown, label: "Valor" },
            { color: C.gold, label: "%" },
          ]}
        >
          <RankChart data={data.rankDesp} />
        </Panel>
        <Panel
          title="Ranking Receitas"
          legend={[
            { color: C.brown, label: "Valor" },
            { color: C.gold, label: "%" },
          ]}
        >
          <RankChart data={data.rankRec} />
        </Panel>
      </div>
    </div>
  );
}

type MonthRow = Record<string, number | string>;

function MonthTick({
  x,
  y,
  payload,
  openMonth,
  onPick,
}: {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  openMonth: number | null;
  onPick: (m: number) => void;
}) {
  if (!payload) return null;
  const selected = openMonth === payload.index;
  return (
    <text
      x={x}
      y={Number(y) + 12}
      textAnchor="middle"
      fontSize={11}
      fontWeight={selected ? 700 : 400}
      fill={selected ? C.brown : C.ink}
      style={{ cursor: "pointer" }}
      onClick={() => onPick(payload.index)}
    >
      {payload.value}
    </text>
  );
}

// Colunas por mes: pendentes empilhados (em atraso + a vencer) ao lado do realizado.
// Clicar numa coluna ou no nome do mes abre a lista de detalhes.
function MonthBars({
  data,
  keys,
  names,
  openMonth,
  onPick,
}: {
  data: MonthRow[];
  keys: { paid: string; late: string; soon: string; total: string };
  names: { paid: string; soon: string };
  openMonth: number | null;
  onPick: (month: number) => void;
}) {
  const cells = (fill: string) =>
    data.map((_, i) => <Cell key={i} fill={fill} fillOpacity={openMonth == null || openMonth === i ? 1 : 0.4} />);
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece7da" />
          <XAxis
            dataKey="mes"
            tickLine={false}
            tick={(p) => <MonthTick {...(p as object)} openMonth={openMonth} onPick={onPick} />}
          />
          <YAxis hide />
          <Tooltip formatter={tooltipMoney} />
          <Bar
            dataKey={keys.late}
            name="Em atraso"
            stackId="pend"
            fill={C.overdue}
            style={{ cursor: "pointer" }}
            onClick={(_, i) => onPick(i)}
          >
            {cells(C.overdue)}
          </Bar>
          <Bar
            dataKey={keys.soon}
            name={names.soon}
            stackId="pend"
            fill={C.beige}
            radius={[3, 3, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(_, i) => onPick(i)}
          >
            {cells(C.beige)}
            <LabelList dataKey={keys.total} position="top" formatter={label} fontSize={9} fill={C.ink} />
          </Bar>
          <Bar
            dataKey={keys.paid}
            name={names.paid}
            fill={C.brown}
            radius={[3, 3, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(_, i) => onPick(i)}
          >
            {cells(C.brown)}
            <LabelList dataKey={keys.paid} position="top" formatter={label} fontSize={9} fill={C.ink} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const KIND_STYLE: Record<Kind, { bg: string; fg: string }> = {
  paga: { bg: `${C.green}1F`, fg: C.green },
  atraso: { bg: `${C.red}1F`, fg: C.red },
  avencer: { bg: `${C.gold}2E`, fg: "#8A7420" },
};

const dateBr = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

// Lista dos lancamentos do mes clicado (pagos/recebidos e pendentes).
function MonthDetails({
  title,
  month,
  entries,
  partnerLabel,
  labels,
  onClose,
}: {
  title: string;
  month: number;
  entries: Entry[];
  partnerLabel: string;
  labels: { paid: string; soon: string };
  onClose: () => void;
}) {
  const rows = useMemo(
    () =>
      entries
        .filter((e) => Number(e.date.slice(5, 7)) === month + 1)
        .sort((a, b) => a.date.localeCompare(b.date) || b.valor - a.valor),
    [entries, month]
  );
  const total = rows.reduce((s, r) => s + r.valor, 0);
  const kindLabel: Record<Kind, string> = { paga: labels.paid, atraso: "Em atraso", avencer: labels.soon };

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.tan, background: "#FBF9F4" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold" style={{ color: C.ink }}>
          {title}
          <span className="ml-2 font-normal text-neutral-500">
            {rows.length} lançamento{rows.length === 1 ? "" : "s"} · {brl2.format(total)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ background: C.tan, color: C.ink }}
        >
          Fechar ✕
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400">Nenhum lançamento neste mês.</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0" style={{ background: "#FBF9F4" }}>
              <tr className="text-left font-semibold uppercase" style={{ color: C.brown }}>
                <th className="px-2 py-1.5">Data</th>
                <th className="px-2 py-1.5">Descrição</th>
                <th className="px-2 py-1.5">{partnerLabel}</th>
                <th className="px-2 py-1.5">Conta / serviço</th>
                <th className="px-2 py-1.5">Situação</th>
                <th className="px-2 py-1.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top" style={{ borderColor: "#eee8d8" }}>
                  <td className="whitespace-nowrap px-2 py-1.5">{dateBr(r.date)}</td>
                  <td className="px-2 py-1.5">{r.descricao || "—"}</td>
                  <td className="px-2 py-1.5">{r.parceiro || "—"}</td>
                  <td className="px-2 py-1.5">{r.conta}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 font-medium"
                      style={{ background: KIND_STYLE[r.kind].bg, color: KIND_STYLE[r.kind].fg }}
                    >
                      {kindLabel[r.kind]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">{brl2.format(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const pctText = (v: unknown) => `${String(v).replace(".", ",")}%`;

function RankChart({ data }: { data: Rank[] }) {
  return (
    <ComboChart
      data={data.map((r) => ({ name: r.name, label: r.label, valor: r.valor, linha: r.pct }))}
      barName="Valor"
      lineName="%"
      lineFormat={pctText}
      height={320}
    />
  );
}
