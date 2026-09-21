"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ArrowUpRight, Trash2, Plus } from "lucide-react";
import clsx from "clsx";
import type { Client } from "@/lib/supabase/types";
import { buildTaskTree, type TaskWithAssignee } from "@/lib/data/tasks";
import { TableRow } from "@/components/views/TableView";

export function GroupedTableView({
  clients,
  tasksByClient,
  onOpenTask,
  onDeleteTask,
  onDeleteClient,
  onAddTaskToClient,
}: {
  clients: Client[];
  tasksByClient: Map<string, TaskWithAssignee[]>;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteClient: (clientId: string) => void;
  onAddTaskToClient: (client: Client) => void;
}) {
  return (
    <div className="overflow-x-auto px-6 py-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-4">Cliente / Etapa</th>
            <th className="py-2 pr-4">Serviço</th>
            <th className="py-2 pr-4">O.S</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Responsável</th>
            <th className="py-2 pr-4">Data limite</th>
            <th className="w-8 py-2" />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <ClientGroup
              key={client.id}
              client={client}
              tasks={tasksByClient.get(client.id) ?? []}
              onOpenTask={onOpenTask}
              onDeleteTask={onDeleteTask}
              onDeleteClient={onDeleteClient}
              onAddTaskToClient={onAddTaskToClient}
            />
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-neutral-400">
                Nenhum cliente encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClientGroup({
  client,
  tasks,
  onOpenTask,
  onDeleteTask,
  onDeleteClient,
  onAddTaskToClient,
}: {
  client: Client;
  tasks: TaskWithAssignee[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteClient: (clientId: string) => void;
  onAddTaskToClient: (client: Client) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tree = buildTaskTree(tasks);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <tr className="group border-b border-neutral-200 bg-neutral-50/80">
        <td className="py-2 pr-4" colSpan={6}>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setExpanded((v) => !v)} className="text-neutral-500">
              <ChevronRight size={15} className={clsx("transition", expanded && "rotate-90")} />
            </button>
            <span className="font-semibold text-neutral-900">{client.name}</span>
            <span className="text-xs text-neutral-400">({tasks.length})</span>
            {total > 0 && (
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  pct === 100 ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
                )}
                title={`${done} de ${total} etapas concluídas`}
              >
                {pct}%
              </span>
            )}
            <Link
              href={`/clients/${client.id}`}
              className="ml-1 text-neutral-400 hover:text-neutral-700"
              title="Abrir página do cliente"
            >
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </td>
        <td className="py-2 pr-2 text-right">
          <button
            onClick={() => {
              if (confirm(`Excluir o cliente "${client.name}" e todas as suas ${tasks.length} etapas?`)) {
                onDeleteClient(client.id);
              }
            }}
            className="text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
            title="Excluir cliente"
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>

      {expanded && (
        <>
          {tree.map((task) => (
            <TableRow key={task.id} task={task} depth={1} onOpenTask={onOpenTask} onDeleteTask={onDeleteTask} />
          ))}
          <tr>
            <td colSpan={7} className="py-1 pl-7">
              <button
                onClick={() => onAddTaskToClient(client)}
                className="flex items-center gap-1 py-1 text-xs text-neutral-400 hover:text-neutral-700"
              >
                <Plus size={12} /> Nova etapa
              </button>
            </td>
          </tr>
        </>
      )}
    </>
  );
}
