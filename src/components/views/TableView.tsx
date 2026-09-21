"use client";

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import clsx from "clsx";
import { assigneeDisplay, type TaskNode } from "@/lib/data/tasks";
import { StatusBadge } from "@/components/StatusBadge";

export function TableView({
  tasks,
  onOpenTask,
  onDeleteTask,
}: {
  tasks: TaskNode[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}) {
  return (
    <div className="overflow-x-auto px-6 py-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-4">Etapa</th>
            <th className="py-2 pr-4">Serviço</th>
            <th className="py-2 pr-4">O.S</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Responsável</th>
            <th className="py-2 pr-4">Data limite</th>
            <th className="w-8 py-2" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TableRow key={task.id} task={task} depth={0} onOpenTask={onOpenTask} onDeleteTask={onDeleteTask} />
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-neutral-400">
                Nenhuma etapa encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({
  task,
  depth,
  onOpenTask,
  onDeleteTask,
}: {
  task: TaskNode;
  depth: number;
  onOpenTask: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = task.children.length > 0;

  return (
    <>
      <tr className="group border-b border-neutral-100 hover:bg-neutral-50">
        <td className="py-2 pr-4">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded((v) => !v)} className="text-neutral-400">
                <ChevronRight size={14} className={clsx("transition", expanded && "rotate-90")} />
              </button>
            ) : (
              <span className="w-[14px]" />
            )}
            <button onClick={() => onOpenTask(task.id)} className="text-left font-medium text-neutral-900 hover:underline">
              {task.title}
            </button>
          </div>
        </td>
        <td className="py-2 pr-4 text-neutral-600">{task.service ?? "—"}</td>
        <td className="py-2 pr-4 text-neutral-600">{task.os_number ?? "—"}</td>
        <td className="py-2 pr-4">
          <StatusBadge status={task.status} />
        </td>
        <td className="py-2 pr-4 text-neutral-600">{assigneeDisplay(task)}</td>
        <td className="py-2 pr-4 text-neutral-600">
          {task.due_date ? new Date(task.due_date).toLocaleDateString("pt-BR") : "—"}
        </td>
        <td className="py-2 pr-2 text-right">
          {onDeleteTask && (
            <button
              onClick={() => {
                if (confirm(`Excluir a etapa "${task.title}"?`)) onDeleteTask(task.id);
              }}
              className="text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
              title="Excluir etapa"
            >
              <Trash2 size={14} />
            </button>
          )}
        </td>
      </tr>
      {expanded && task.children.map((child) => (
        <TableRow key={child.id} task={child} depth={depth + 1} onOpenTask={onOpenTask} onDeleteTask={onDeleteTask} />
      ))}
    </>
  );
}
