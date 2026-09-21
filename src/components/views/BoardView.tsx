"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { Client, TaskStatus } from "@/lib/supabase/types";
import { assigneeDisplay, type TaskWithAssignee } from "@/lib/data/tasks";
import { STATUS_LABEL, STATUS_ORDER, STATUS_STYLE } from "@/components/status";

export function BoardView({
  tasks,
  clients,
  onOpenTask,
  onStatusChange,
}: {
  tasks: TaskWithAssignee[];
  clients: Client[];
  onOpenTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.status !== newStatus) {
      onStatusChange(task.id, newStatus);
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto px-6 py-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            clients={clients}
            tasks={tasks.filter((t) => t.status === status)}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
      <DragOverlay>{activeTask && <Card task={activeTask} onOpenTask={() => {}} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  clients,
  tasks,
  onOpenTask,
}: {
  status: TaskStatus;
  clients: Client[];
  tasks: TaskWithAssignee[];
  onOpenTask: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const clientGroups = clients
    .map((client) => ({ client, tasks: tasks.filter((t) => t.client_id === client.id) }))
    .filter((g) => g.tasks.length > 0);

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex w-80 shrink-0 flex-col rounded-lg p-3 transition",
        STATUS_STYLE[status].column,
        isOver && "ring-2 ring-neutral-400"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-neutral-700">{STATUS_LABEL[status]}</h3>
        <span className="text-xs text-neutral-400">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {clientGroups.map(({ client, tasks: clientTasks }) => (
          <ClientGroup key={client.id} client={client} tasks={clientTasks} onOpenTask={onOpenTask} />
        ))}
        {clientGroups.length === 0 && (
          <p className="px-1 text-xs text-neutral-400">Nenhuma etapa aqui.</p>
        )}
      </div>
    </div>
  );
}

function ClientGroup({
  client,
  tasks,
  onOpenTask,
}: {
  client: Client;
  tasks: TaskWithAssignee[];
  onOpenTask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-neutral-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left"
      >
        <ChevronRight size={13} className={clsx("shrink-0 text-neutral-400 transition", expanded && "rotate-90")} />
        <span className="flex-1 truncate text-sm font-medium text-neutral-900">{client.name}</span>
        <span className="text-xs text-neutral-400">{tasks.length}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-neutral-100 p-2">
          {tasks.map((task) => (
            <Card key={task.id} task={task} onOpenTask={onOpenTask} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({
  task,
  onOpenTask,
  dragging,
}: {
  task: TaskWithAssignee;
  onOpenTask: (id: string) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpenTask(task.id)}
      className={clsx(
        "cursor-grab rounded-md border border-neutral-200 bg-neutral-50 p-2.5 text-sm shadow-sm active:cursor-grabbing",
        dragging && "shadow-lg"
      )}
    >
      <p className="font-medium text-neutral-900">{task.title}</p>
      {task.service && <p className="mt-0.5 text-xs text-neutral-500">{task.service}</p>}
      {(task.assignee || task.assignee_name) && (
        <p className="mt-1.5 text-xs text-neutral-400">{assigneeDisplay(task)}</p>
      )}
    </div>
  );
}
