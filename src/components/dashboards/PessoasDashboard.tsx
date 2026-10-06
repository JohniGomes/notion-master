"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeopleTask } from "@/lib/data/shop9";
import { C, ChipGroup, DashTitle, Empty, Panel, StatCard, toggleIn } from "@/components/dashboards/theme";

type Status = PeopleTask["status"];
const STATUS_LABEL: Record<Status, string> = {
  done: "Concluído",
  in_progress: "Em andamento",
  not_started: "Pendente",
};
const STATUS_COLOR: Record<Status, string> = {
  done: C.green,
  in_progress: C.gray,
  not_started: C.red,
};
const PAGE = 100;

export function PessoasDashboard({ tasks }: { tasks: PeopleTask[] }) {
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  const allPeople = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.responsavel))).sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (statuses.size === 0 || statuses.has(t.status)) && (people.size === 0 || people.has(t.responsavel))
      ),
    [tasks, statuses, people]
  );

  const count = (s: Status) => filtered.filter((t) => t.status === s).length;

  const byPerson = useMemo(() => {
    const map = new Map<string, Record<Status, number>>();
    for (const t of filtered) {
      const cur = map.get(t.responsavel) ?? { done: 0, in_progress: 0, not_started: 0 };
      cur[t.status] += 1;
      map.set(t.responsavel, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, total: v.done + v.in_progress + v.not_started }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? filtered.filter((t) =>
          `${t.os ?? ""} ${t.cliente} ${t.servico ?? ""} ${t.etapa} ${t.responsavel}`.toLowerCase().includes(q)
        )
      : filtered;
    return [...list].sort((a, b) => (b.os ?? 0) - (a.os ?? 0) || a.etapa.localeCompare(b.etapa));
  }, [filtered, search]);

  return (
    <div className="space-y-6 rounded-2xl p-4 sm:p-6" style={{ background: C.cream }}>
      <DashTitle name="People" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Big label="Concluídas" value={count("done")} />
            <Big label="Em Andamento" value={count("in_progress")} />
            <Big label="Pendente" value={count("not_started")} />
          </div>
          <ChipGroup
            title="Status"
            cols={3}
            options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            selected={statuses}
            onToggle={(v) => setStatuses((s) => toggleIn(s, v))}
            onClear={() => setStatuses(new Set())}
          />
          <ChipGroup
            title="Responsável"
            cols={2}
            options={allPeople.map((p) => ({ value: p, label: p }))}
            selected={people}
            onToggle={(v) => setPeople((s) => toggleIn(s, v))}
            onClear={() => setPeople(new Set())}
          />
        </div>

        <Panel title="Status por colaborador">
          {byPerson.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ height: Math.max(260, byPerson.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPerson} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid horizontal={false} stroke="#ece7da" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} fontSize={11} tickLine={false} interval={0} />
                  <Tooltip />
                  <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="done" name="Concluídos" stackId="s" fill={STATUS_COLOR.done}>
                    <LabelList dataKey="done" position="center" fill="#fff" fontSize={10} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                  <Bar dataKey="in_progress" name="Em andamento" stackId="s" fill={STATUS_COLOR.in_progress}>
                    <LabelList dataKey="in_progress" position="center" fill="#fff" fontSize={10} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                  <Bar dataKey="not_started" name="Pendentes" stackId="s" fill={STATUS_COLOR.not_started}>
                    <LabelList dataKey="not_started" position="center" fill="#fff" fontSize={10} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Etapas">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Buscar por O.S, cliente, serviço, etapa ou responsável"
          className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm outline-none"
          style={{ borderColor: C.tan }}
        />
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0" style={{ background: C.cream }}>
              <tr className="text-left text-xs font-semibold uppercase" style={{ color: C.brown }}>
                <th className="px-2 py-2">O.S</th>
                <th className="px-2 py-2">Etapa</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "#eee8d8" }}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{t.os != null ? `OS ${t.os}` : "—"}</span> · {t.cliente}
                    {t.servico && <span className="text-neutral-500"> · {t.servico}</span>}
                  </td>
                  <td className="px-2 py-1.5">{t.etapa}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ background: STATUS_COLOR[t.status] }}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{t.responsavel}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <Empty />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > shown && (
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="mt-3 w-full rounded-md py-1.5 text-sm font-medium"
            style={{ background: C.tan, color: C.ink }}
          >
            Mostrar mais ({rows.length - shown} restantes)
          </button>
        )}
      </Panel>
    </div>
  );
}

function Big({ label, value }: { label: string; value: number }) {
  return (
    <StatCard label={label} value={String(value)}>
      <span />
    </StatCard>
  );
}
