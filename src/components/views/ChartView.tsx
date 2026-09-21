"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { TaskWithAssignee } from "@/lib/data/tasks";
import { STATUS_LABEL, STATUS_ORDER } from "@/components/status";

const STATUS_COLOR: Record<string, string> = {
  not_started: "#a3a3a3",
  in_progress: "#3b82f6",
  done: "#22c55e",
};

export function ChartView({ tasks }: { tasks: TaskWithAssignee[] }) {
  const byStatus = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        label: STATUS_LABEL[status],
        total: tasks.filter((t) => t.status === status).length,
      })),
    [tasks]
  );

  const byAssignee = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      const label = t.assignee?.full_name || t.assignee?.email || t.assignee_name || "Sem responsável";
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, total]) => ({ label, total }));
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 gap-8 px-6 py-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Etapas por status</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byStatus}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {byStatus.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Etapas por responsável</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byAssignee} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" fill="#404040" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
