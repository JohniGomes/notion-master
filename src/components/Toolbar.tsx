"use client";

import { Search, LayoutGrid, Table2, Calendar, BarChart3 } from "lucide-react";
import clsx from "clsx";
import type { TaskStatus } from "@/lib/supabase/types";
import { STATUS_LABEL } from "@/components/status";

export type ViewMode = "table" | "board" | "calendar" | "chart";
export type SortKey = "title" | "os_number" | "due_date";

const VIEWS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: "table", label: "Tabela", icon: Table2 },
  { key: "board", label: "Quadro", icon: LayoutGrid },
  { key: "calendar", label: "Calendário", icon: Calendar },
  { key: "chart", label: "Gráfico", icon: BarChart3 },
];

export function Toolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  sortKey,
  onSortKeyChange,
  assigneeOptions,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: TaskStatus | "all";
  onStatusFilterChange: (v: TaskStatus | "all") => void;
  assigneeFilter: string | "all";
  onAssigneeFilterChange: (v: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (v: SortKey) => void;
  /** Nomes de exibição únicos (contas cadastradas + responsáveis por nome livre). */
  assigneeOptions: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar etapa ou serviço..."
          className="w-56 rounded-md border border-neutral-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as TaskStatus | "all")}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-700 outline-none"
      >
        <option value="all">Todos os status</option>
        {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        value={assigneeFilter}
        onChange={(e) => onAssigneeFilterChange(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-700 outline-none"
      >
        <option value="all">Todos os responsáveis</option>
        {assigneeOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        value={sortKey}
        onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-700 outline-none"
      >
        <option value="title">Ordenar: Nome</option>
        <option value="os_number">Ordenar: O.S</option>
        <option value="due_date">Ordenar: Data limite</option>
      </select>

      <div className="ml-auto flex items-center gap-1 rounded-md bg-neutral-100 p-1">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={clsx(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition",
              view === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
