"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { assigneeDisplay, buildTaskTree, deleteTask, restoreTask, updateTask } from "@/lib/data/tasks";
import { deleteClient, restoreClient, updateClientCover } from "@/lib/data/clients";
import { useToast } from "@/components/ToastProvider";
import type { TaskWithAssignee } from "@/lib/data/tasks";
import type { Client, Profile, Task, TaskStatus } from "@/lib/supabase/types";
import { CoverUploader } from "@/components/CoverUploader";
import { Toolbar, type ViewMode, type SortKey } from "@/components/Toolbar";
import { TableView } from "@/components/views/TableView";
import { BoardView } from "@/components/views/BoardView";
import { CalendarView } from "@/components/views/CalendarView";
import { ChartView } from "@/components/views/ChartView";
import { TaskPanel } from "@/components/TaskPanel";
import { NewServiceModal } from "@/components/NewServiceModal";

export function ClientPageClient({
  client,
  initialTasks,
  profiles,
  currentUserId,
}: {
  client: Client;
  initialTasks: TaskWithAssignee[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { showUndo } = useToast();

  const [tasks, setTasks] = useState<TaskWithAssignee[]>(initialTasks);
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = tasks;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.service?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (assigneeFilter !== "all") {
      list = list.filter((t) => assigneeDisplay(t) === assigneeFilter);
    }

    return [...list].sort((a, b) => {
      if (sortKey === "os_number") return (a.os_number ?? 0) - (b.os_number ?? 0);
      if (sortKey === "due_date") return (a.due_date ?? "").localeCompare(b.due_date ?? "");
      return a.title.localeCompare(b.title);
    });
  }, [tasks, search, statusFilter, assigneeFilter, sortKey]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    profiles.forEach((p) => {
      const label = p.full_name || p.email;
      if (label) names.add(label);
    });
    tasks.forEach((t) => {
      const label = assigneeDisplay(t);
      if (label !== "—") names.add(label);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [profiles, tasks]);

  const tree = useMemo(() => buildTaskTree(filtered), [filtered]);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  function patchTask(id: string, patch: Partial<TaskWithAssignee>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    patchTask(taskId, { status });
    await updateTask(supabase, taskId, { status });
  }

  async function handleDeleteTask(taskId: string) {
    const removed = tasks.find((t) => t.id === taskId);
    const removedChildren = tasks.filter((t) => t.parent_id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId && t.parent_id !== taskId));
    if (openTaskId === taskId) setOpenTaskId(null);
    await deleteTask(supabase, taskId);

    if (removed) {
      showUndo(`Etapa "${removed.title}" excluída.`, async () => {
        await restoreTask(supabase, taskId);
        setTasks((prev) => [...prev, removed, ...removedChildren]);
      });
    }
  }

  async function handleDeleteClient() {
    if (!confirm(`Excluir o cliente "${client.name}" e todas as suas ${tasks.length} etapas?`)) return;
    await deleteClient(supabase, client.id);
    router.push("/");
    showUndo(`Cliente "${client.name}" excluído.`, async () => {
      await restoreClient(supabase, client.id);
      router.push(`/clients/${client.id}`);
    });
  }

  function handleTaskCreated(task: Task) {
    const assignee = profiles.find((p) => p.id === task.assignee_id) ?? null;
    setTasks((prev) => [...prev, { ...task, assignee }]);
  }

  return (
    <div>
      <CoverUploader
        folder={`client-${client.id}`}
        coverUrl={client.cover_url}
        onSave={(url) => updateClientCover(supabase, client.id, url)}
      />

      <div className="flex items-center justify-between px-6 pt-4">
        <h1 className="text-2xl font-semibold text-neutral-900">{client.name}</h1>
        <button
          onClick={handleDeleteClient}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-red-500"
        >
          <Trash2 size={15} /> Excluir cliente
        </button>
      </div>

      <Toolbar
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        assigneeOptions={assigneeOptions}
      />

      <div className="px-6 pt-3">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <Plus size={14} /> Nova etapa
        </button>
      </div>

      {view === "table" && (
        <TableView tasks={tree} onOpenTask={setOpenTaskId} onDeleteTask={handleDeleteTask} />
      )}
      {view === "board" && (
        <BoardView
          tasks={filtered}
          clients={[client]}
          onOpenTask={setOpenTaskId}
          onStatusChange={handleStatusChange}
        />
      )}
      {view === "calendar" && <CalendarView tasks={filtered} onOpenTask={setOpenTaskId} />}
      {view === "chart" && <ChartView tasks={filtered} />}

      {openTask && (
        <TaskPanel
          task={openTask}
          profiles={profiles}
          currentUserId={currentUserId}
          onClose={() => setOpenTaskId(null)}
          onTaskUpdated={(patch) => patchTask(openTask.id, patch)}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {modalOpen && (
        <NewServiceModal
          spaceId={client.space_id}
          clients={[client]}
          profiles={profiles}
          currentUserId={currentUserId}
          fixedClient={client}
          onClose={() => setModalOpen(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
