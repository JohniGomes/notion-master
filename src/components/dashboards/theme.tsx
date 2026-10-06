"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Paleta extraida dos dashboards originais da Master.
export const C = {
  brown: "#74500E",
  gold: "#BFA22E",
  beige: "#EEDFB4",
  tan: "#E7C98C",
  cream: "#F5F3EE",
  ink: "#3B3B3B",
  green: "#12A150",
  red: "#E03B30",
  gray: "#8C8C8C",
};

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Cabecalho unico: titulo a esquerda, filtros a direita, numa linha so.
export function DashHeader({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-light tracking-wide" style={{ color: C.ink }}>
        DASHBOARD {name.toUpperCase()} <span className="mx-1 font-extralight">|</span>
        <span className="font-normal">RESULTADOS</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Cartao com a etiqueta no topo, como nos dashboards originais.
export function StatCard({
  label,
  value,
  valueColor = C.gold,
  delta,
  children,
}: {
  label: string;
  value: string;
  valueColor?: string;
  delta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl bg-white px-4 pb-3 pt-5 shadow-md">
      <span
        className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-md bg-white px-3 py-0.5 text-xs font-medium shadow-sm"
        style={{ color: C.ink }}
      >
        {label}
      </span>
      <div className="text-2xl font-semibold tracking-tight" style={{ color: valueColor }}>
        {value}
      </div>
      {children && <div className="mt-1 text-xs">{children}</div>}
      {delta && (
        <div className="mt-2 border-t pt-2" style={{ borderColor: "#eee8d8" }}>
          {delta}
        </div>
      )}
    </div>
  );
}

// Indicadores secundarios do cartao: titulo pequeno em cima de cada numero, em colunas iguais.
export function MiniStats({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <div className="truncate text-[10px] uppercase tracking-wide text-neutral-500">{i.label}</div>
          <div className="truncate text-sm font-semibold" style={{ color: i.color ?? C.ink }}>
            {i.value}
          </div>
        </div>
      ))}
    </div>
  );
}

const pctFmt = (v: number) => `${(Math.abs(v) * 100).toFixed(1).replace(".", ",")}%`;

/**
 * Comparacao com o periodo anterior. mode "pct" = variacao percentual; "pp" = diferenca em
 * pontos percentuais (para valores que ja sao %); "abs" = diferenca no proprio valor (para
 * valores que podem ser negativos ou perto de zero). `inverse`: subir e ruim (ex.: despesa).
 * `neutral`: sem juizo de bom/ruim.
 */
export function Delta({
  current,
  previous,
  label,
  format,
  mode = "pct",
  inverse = false,
  neutral = false,
}: {
  current: number;
  previous: number;
  label: string;
  format: (v: number) => string;
  mode?: "pct" | "pp" | "abs";
  inverse?: boolean;
  neutral?: boolean;
}) {
  const diff = current - previous;
  const flat = Math.abs(diff) < 1e-9;
  const up = diff > 0;
  const good = inverse ? !up : up;
  const color = neutral || flat ? C.gray : good ? C.green : C.red;

  let text: string;
  if (flat) text = "0%";
  else if (mode === "pp") text = `${Math.abs(diff).toFixed(1).replace(".", ",")} p.p.`;
  else if (mode === "abs") text = format(Math.abs(diff));
  else if (previous === 0) text = "novo";
  else if (Math.abs(diff / previous) > 10) text = ">999%";
  else text = pctFmt(diff / Math.abs(previous));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
      <span
        className="rounded-full px-2 py-0.5 font-semibold"
        style={{ background: `${color}1F`, color }}
      >
        {flat ? "=" : up ? "▲" : "▼"} {text}
      </span>
      <span className="text-neutral-500">
        vs {label} · {format(previous)}
      </span>
    </div>
  );
}

export type LegendItem = { color: string; label: string };

// Painel com a legenda na mesma linha do titulo (o grafico comeca logo abaixo).
export function Panel({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: LegendItem[];
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl bg-white px-4 pb-3 pt-6 shadow-md">
      <span
        className="absolute left-4 top-0 -translate-y-1/2 rounded-md bg-white px-4 py-1 text-xs font-medium uppercase shadow-sm"
        style={{ color: C.ink }}
      >
        {title}
      </span>
      {legend && (
        <div className="absolute right-4 top-0 flex -translate-y-1/2 items-center gap-3 rounded-md bg-white px-3 py-1 text-xs shadow-sm">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5" style={{ color: C.ink }}>
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// Menu de filtro com varias opcoes marcaveis (vazio = sem filtro). Fecha ao clicar fora.
export function FilterDropdown({
  title,
  options,
  selected,
  onToggle,
  onClear,
  cols = 4,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  cols?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const active = selected.size > 0;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition"
        style={{ background: active ? C.brown : C.tan, color: active ? "#fff" : C.ink }}
      >
        {title}
        {active && <span className="rounded-full bg-white/25 px-1.5 text-xs">{selected.size}</span>}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-max max-w-[92vw] rounded-xl bg-white p-3 shadow-lg"
          style={{ border: `1px solid ${C.tan}` }}
        >
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.5rem, 1fr))` }}>
            {options.map((o) => {
              const on = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => onToggle(o.value)}
                  className="whitespace-nowrap rounded px-2 py-1 text-xs transition"
                  style={{ background: on ? C.brown : C.tan, color: on ? "#fff" : C.ink }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {active && (
            <button onClick={onClear} className="mt-2 text-xs underline" style={{ color: C.brown }}>
              limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function Empty() {
  return <p className="py-10 text-center text-sm text-neutral-400">Sem dados no período.</p>;
}
