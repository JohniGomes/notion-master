"use client";

import { useState } from "react";
import type { Shop9Conta, Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";
import type { PeopleTask } from "@/lib/data/shop9";
import { C } from "@/components/dashboards/theme";
import { FinanceiroDashboard } from "@/components/dashboards/FinanceiroDashboard";
import { ComercialDashboard } from "@/components/dashboards/ComercialDashboard";
import { PessoasDashboard } from "@/components/dashboards/PessoasDashboard";

const TABS = [
  { id: "financeiro", label: "Financeiro" },
  { id: "comercial", label: "Comercial" },
  { id: "pessoas", label: "Pessoas" },
] as const;

export function DashboardTabs({
  contas,
  commercial,
  tasks,
}: {
  contas: Shop9Conta[];
  commercial: { os: Shop9Os[]; itens: Shop9OsItem[]; situacoes: Shop9Lookup[]; tipos: Shop9Lookup[] };
  tasks: PeopleTask[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("financeiro");

  return (
    <div className="px-6 pb-10 pt-4">
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-full px-5 py-1.5 text-sm font-medium transition"
            style={{
              background: tab === t.id ? C.brown : C.tan,
              color: tab === t.id ? "#fff" : C.ink,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "financeiro" && <FinanceiroDashboard contas={contas} />}
      {tab === "comercial" && <ComercialDashboard {...commercial} />}
      {tab === "pessoas" && <PessoasDashboard tasks={tasks} />}
    </div>
  );
}
