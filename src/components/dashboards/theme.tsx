"use client";

import type { ReactNode } from "react";

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

export function DashTitle({ name }: { name: string }) {
  return (
    <h2 className="text-2xl font-light tracking-wide" style={{ color: C.ink }}>
      DASHBOARD {name.toUpperCase()} <span className="mx-1 font-extralight">|</span>
      <span className="font-normal">RESULTADOS</span>
    </h2>
  );
}

// Cartao com a etiqueta no topo, como nos dashboards originais.
export function StatCard({
  label,
  value,
  valueColor = C.gold,
  children,
}: {
  label: string;
  value: string;
  valueColor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl bg-white px-4 pb-3 pt-6 shadow-md">
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
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-white px-4 pb-4 pt-7 shadow-md">
      <span
        className="absolute left-4 top-0 -translate-y-1/2 rounded-md bg-white px-4 py-1 text-xs font-medium uppercase shadow-sm"
        style={{ color: C.ink }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

export function ChipGroup({
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
  return (
    <div>
      <div className="mb-1 flex items-center justify-between border-b pb-0.5" style={{ borderColor: C.brown }}>
        <span className="text-sm font-medium" style={{ color: C.ink }}>
          {title}
        </span>
        {selected.size > 0 && (
          <button onClick={onClear} className="text-xs underline" style={{ color: C.brown }}>
            limpar
          </button>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = selected.has(o.value);
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              className="rounded px-2 py-1 text-xs transition"
              style={{
                background: active ? C.brown : C.tan,
                color: active ? "#fff" : C.ink,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
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
