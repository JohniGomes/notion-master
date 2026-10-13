"use client";

import { useMemo, useState } from "react";
import type { Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";
import { useDateFilters } from "@/components/dashboards/DateFilters";
import { ComboChart } from "@/components/dashboards/ComboChart";
import { brl, brl2, C, DashHeader, Delta, Panel, StatCard, StatRows } from "@/components/dashboards/theme";

// Nomes dos tipos de O.S no Shop9 (Configuracoes_Ordem_Servico_Tipos).
const TIPO_ORCAMENTO = "Orçamento";
const TIPO_APROVADO = "Contratado";
const TIPO_NAO_APROVADO = "Não Aprovado";

const trunc = (s: string, n = 20) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type Bucket = { name: string; label: string; valor: number; qtd: number };

type OpenKey = { kind: "situacao" | "servico" | "cliente"; name: string } | null;
type OsRow = {
  id: string;
  numero: number | null;
  cliente: string;
  descricao: string;
  tipo: string;
  situacao: string;
  data: string;
  valor: number;
};

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
  const { matches, ui, previous } = useDateFilters(years, years.at(-1));

  const filtered = useMemo(() => os.filter((o) => matches(o.data_gravacao)), [os, matches]);
  const tipoNome = useMemo(() => new Map(tipos.map((t) => [t.ordem, t.nome])), [tipos]);
  const situacaoNome = useMemo(() => new Map(situacoes.map((s) => [s.ordem, s.nome])), [situacoes]);

  // Clique numa coluna abre a tabela das O.S por tras dela (uma por vez).
  const [open, setOpen] = useState<OpenKey>(null);
  const pick = (kind: "situacao" | "servico" | "cliente") => (name: string) =>
    setOpen((cur) => (cur && cur.kind === kind && cur.name === name ? null : { kind, name }));

  const detailRows = useMemo<OsRow[]>(() => {
    if (!open) return [];
    const tipoDe = (o: Shop9Os) => tipoNome.get(o.tipo_ordem ?? -1) ?? "—";
    const situacaoDe = (o: Shop9Os) => situacaoNome.get(o.situacao_ordem ?? -1) ?? "Sem situação";
    const row = (id: string, o: Shop9Os, valor: number): OsRow => ({
      id,
      numero: o.numero,
      cliente: o.cliente ?? "—",
      descricao: o.descricao ?? "",
      tipo: tipoDe(o),
      situacao: situacaoDe(o),
      data: o.data_gravacao ?? "",
      valor,
    });
    let rows: OsRow[];
    if (open.kind === "situacao") {
      rows = filtered.filter((o) => situacaoDe(o) === open.name).map((o) => row(String(o.ordem), o, o.valor_total));
    } else if (open.kind === "cliente") {
      rows = filtered
        .filter((o) => (o.cliente || "Sem cliente") === open.name)
        .map((o) => row(String(o.ordem), o, o.valor_total));
    } else {
      const byMov = new Map(filtered.map((o) => [o.ordem_movimento, o]));
      rows = itens
        .filter((i) => i.servico_nome === open.name && byMov.has(i.ordem_movimento))
        .map((i) => row(`i${i.ordem}`, byMov.get(i.ordem_movimento)!, i.preco_final));
    }
    return rows.sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0));
  }, [open, filtered, itens, tipoNome, situacaoNome]);

  const details = open && (
    <OsDetails
      title={
        open.kind === "situacao"
          ? `Situação · ${open.name}`
          : open.kind === "servico"
            ? `Tipo de O.S · ${open.name}`
            : `O.S por cliente · ${open.name}`
      }
      valueLabel={open.kind === "servico" ? "Valor do serviço" : "Valor da O.S"}
      rows={detailRows}
      onClose={() => setOpen(null)}
    />
  );

  const kpisOf = useMemo(
    () => (list: Shop9Os[]) => {
      const by = (nome: string) => {
        const sub = list.filter((o) => tipoNome.get(o.tipo_ordem ?? -1) === nome);
        return { qtd: sub.length, valor: sub.reduce((s, o) => s + o.valor_total, 0) };
      };
      const orcado = { qtd: list.length, valor: list.reduce((s, o) => s + o.valor_total, 0) };
      const clientes = new Set(list.map((o) => o.cliente).filter(Boolean)).size;
      return {
        orcado,
        aprovado: by(TIPO_APROVADO),
        emAprovacao: by(TIPO_ORCAMENTO),
        naoAprovado: by(TIPO_NAO_APROVADO),
        clientes,
        ticket: clientes > 0 ? orcado.valor / clientes : 0,
      };
    },
    [tipoNome]
  );
  const kpis = useMemo(() => kpisOf(filtered), [kpisOf, filtered]);
  const prev = useMemo(
    () => (previous ? kpisOf(os.filter((o) => previous.matches(o.data_gravacao))) : null),
    [kpisOf, os, previous]
  );

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
    <div className="space-y-5 rounded-2xl p-4 sm:p-5" style={{ background: C.cream }}>
      <DashHeader name="Comercial">{ui}</DashHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Orçado"
          value={brl.format(kpis.orcado.valor)}
          delta={
            prev && previous && (
              <Delta current={kpis.orcado.valor} previous={prev.orcado.valor} label={previous.label} format={brl.format} />
            )
          }
          aside={
            <StatRows
              items={[
                { label: "O.S", value: String(kpis.orcado.qtd) },
                {
                  label: "Não aprovado",
                  value: `${kpis.naoAprovado.qtd} · ${brl.format(kpis.naoAprovado.valor)}`,
                  color: C.red,
                },
              ]}
            />
          }
        />
        <StatCard
          label="Aprovado"
          value={brl.format(kpis.aprovado.valor)}
          delta={
            prev && previous && (
              <Delta current={kpis.aprovado.valor} previous={prev.aprovado.valor} label={previous.label} format={brl.format} />
            )
          }
          aside={
            <StatRows
              items={[
                { label: "O.S", value: String(kpis.aprovado.qtd) },
                { label: "% do total", value: pct(kpis.aprovado.qtd), color: C.green },
              ]}
            />
          }
        />
        <StatCard
          label="Em Aprovação"
          value={brl.format(kpis.emAprovacao.valor)}
          delta={
            prev && previous && (
              <Delta
                current={kpis.emAprovacao.valor}
                previous={prev.emAprovacao.valor}
                label={previous.label}
                format={brl.format}
                neutral
              />
            )
          }
          aside={
            <StatRows
              items={[
                { label: "O.S", value: String(kpis.emAprovacao.qtd) },
                { label: "% do total", value: pct(kpis.emAprovacao.qtd), color: C.green },
              ]}
            />
          }
        />
        <StatCard
          label="Ticket Médio"
          value={brl.format(kpis.ticket)}
          delta={
            prev && previous && (
              <Delta current={kpis.ticket} previous={prev.ticket} label={previous.label} format={brl.format} />
            )
          }
          aside={
            <StatRows
              items={[
                { label: "Clientes", value: String(kpis.clientes) },
                { label: "O.S", value: String(kpis.orcado.qtd) },
              ]}
            />
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Situação O.S"
          legend={[
            { color: C.brown, label: "R$" },
            { color: C.gold, label: "Qtd O.S" },
          ]}
        >
          <ValueQtyChart
            data={bySituacao}
            onSelect={pick("situacao")}
            selected={open?.kind === "situacao" ? open.name : null}
          />
        </Panel>
        <Panel title="Tipo de O.S" legend={[{ color: C.brown, label: "R$" }]}>
          <ValueQtyChart
            data={byServico}
            showQty={false}
            onSelect={pick("servico")}
            selected={open?.kind === "servico" ? open.name : null}
          />
        </Panel>
      </div>
      {open && open.kind !== "cliente" && details}
      <Panel
        title="O.S por Cliente"
        legend={[
          { color: C.brown, label: "Valor" },
          { color: C.gold, label: "Qtd de O.S" },
        ]}
      >
        <ValueQtyChart
          data={byCliente}
          height={340}
          onSelect={pick("cliente")}
          selected={open?.kind === "cliente" ? open.name : null}
        />
      </Panel>
      {open && open.kind === "cliente" && details}
    </div>
  );
}

function ValueQtyChart({
  data,
  showQty = true,
  height = 300,
  onSelect,
  selected,
}: {
  data: Bucket[];
  showQty?: boolean;
  height?: number;
  onSelect?: (name: string) => void;
  selected?: string | null;
}) {
  return (
    <ComboChart
      data={data.map((d) => ({ name: d.name, label: d.label, valor: d.valor, linha: d.qtd }))}
      barName="R$"
      lineName={showQty ? "Qtd O.S" : undefined}
      lineFormat={(v) => String(v)}
      height={height}
      onSelect={onSelect}
      selected={selected}
    />
  );
}

const TIPO_STYLE: Record<string, { bg: string; fg: string }> = {
  [TIPO_APROVADO]: { bg: `${C.green}1F`, fg: C.green },
  [TIPO_ORCAMENTO]: { bg: `${C.gold}2E`, fg: "#8A7420" },
  [TIPO_NAO_APROVADO]: { bg: `${C.red}1F`, fg: C.red },
};

const dateBr = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

// Tabela das O.S por tras da coluna clicada (situacao, tipo/servico ou cliente).
function OsDetails({
  title,
  valueLabel,
  rows,
  onClose,
}: {
  title: string;
  valueLabel: string;
  rows: OsRow[];
  onClose: () => void;
}) {
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: C.tan, background: "#FBF9F4" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold" style={{ color: C.ink }}>
          {title}
          <span className="ml-2 font-normal text-neutral-500">
            {rows.length} {rows.length === 1 ? "registro" : "registros"} · {brl2.format(total)}
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
        <p className="py-4 text-center text-sm text-neutral-400">Nenhuma O.S neste período.</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0" style={{ background: "#FBF9F4" }}>
              <tr className="text-left font-semibold uppercase" style={{ color: C.brown }}>
                <th className="px-2 py-1.5">O.S</th>
                <th className="px-2 py-1.5">Cliente</th>
                <th className="px-2 py-1.5">Descrição</th>
                <th className="px-2 py-1.5">Tipo</th>
                <th className="px-2 py-1.5">Situação</th>
                <th className="px-2 py-1.5">Data</th>
                <th className="px-2 py-1.5 text-right">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const style = TIPO_STYLE[r.tipo] ?? { bg: "#eee", fg: C.gray };
                return (
                  <tr key={r.id} className="border-t align-top" style={{ borderColor: "#eee8d8" }}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium">{r.numero ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.cliente}</td>
                    <td className="px-2 py-1.5">{r.descricao || "—"}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 font-medium"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{r.situacao}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{dateBr(r.data)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">{brl2.format(r.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
