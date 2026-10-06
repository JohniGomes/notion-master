"use client";

import { useMemo } from "react";
import type { Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";
import { useDateFilters } from "@/components/dashboards/DateFilters";
import { ComboChart } from "@/components/dashboards/ComboChart";
import { brl, C, DashHeader, Delta, Panel, StatCard } from "@/components/dashboards/theme";

// Nomes dos tipos de O.S no Shop9 (Configuracoes_Ordem_Servico_Tipos).
const TIPO_ORCAMENTO = "Orçamento";
const TIPO_APROVADO = "Contratado";
const TIPO_NAO_APROVADO = "Não Aprovado";

const trunc = (s: string, n = 20) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

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
  const { matches, ui, previous } = useDateFilters(years, years.at(-1));

  const filtered = useMemo(() => os.filter((o) => matches(o.data_gravacao)), [os, matches]);
  const tipoNome = useMemo(() => new Map(tipos.map((t) => [t.ordem, t.nome])), [tipos]);
  const situacaoNome = useMemo(() => new Map(situacoes.map((s) => [s.ordem, s.nome])), [situacoes]);

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
        >
          <div className="font-semibold text-neutral-800">{kpis.orcado.qtd} O.S</div>
          <div className="mt-0.5">
            <span className="font-semibold text-neutral-800">Não aprovado </span>
            <span style={{ color: C.red }}>
              {kpis.naoAprovado.qtd} · {brl.format(kpis.naoAprovado.valor)}
            </span>
          </div>
        </StatCard>
        <StatCard
          label="Aprovado"
          value={brl.format(kpis.aprovado.valor)}
          delta={
            prev && previous && (
              <Delta current={kpis.aprovado.valor} previous={prev.aprovado.valor} label={previous.label} format={brl.format} />
            )
          }
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">{kpis.aprovado.qtd} O.S</span>
            <span style={{ color: C.green }}>{pct(kpis.aprovado.qtd)}</span>
          </div>
        </StatCard>
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
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">{kpis.emAprovacao.qtd} O.S</span>
            <span style={{ color: C.green }}>{pct(kpis.emAprovacao.qtd)}</span>
          </div>
        </StatCard>
        <StatCard
          label="Ticket Médio"
          value={brl.format(kpis.ticket)}
          delta={
            prev && previous && (
              <Delta current={kpis.ticket} previous={prev.ticket} label={previous.label} format={brl.format} />
            )
          }
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">Qtd Clientes</span>
            <span style={{ color: C.green }}>{kpis.clientes}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Situação O.S"
          legend={[
            { color: C.brown, label: "R$" },
            { color: C.gold, label: "Qtd O.S" },
          ]}
        >
          <ValueQtyChart data={bySituacao} />
        </Panel>
        <Panel title="Tipo de O.S" legend={[{ color: C.brown, label: "R$" }]}>
          <ValueQtyChart data={byServico} showQty={false} />
        </Panel>
      </div>
      <Panel
        title="O.S por Cliente"
        legend={[
          { color: C.brown, label: "Valor" },
          { color: C.gold, label: "Qtd de O.S" },
        ]}
      >
        <ValueQtyChart data={byCliente} height={340} />
      </Panel>
    </div>
  );
}

function ValueQtyChart({
  data,
  showQty = true,
  height = 300,
}: {
  data: Bucket[];
  showQty?: boolean;
  height?: number;
}) {
  return (
    <ComboChart
      data={data.map((d) => ({ name: d.name, label: d.label, valor: d.valor, linha: d.qtd }))}
      barName="R$"
      lineName={showQty ? "Qtd O.S" : undefined}
      lineFormat={(v) => String(v)}
      height={height}
    />
  );
}
