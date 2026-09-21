"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { assigneeDisplay, deleteTask, restoreTask, updateTask } from "@/lib/data/tasks";
import { deleteClient, restoreClient } from "@/lib/data/clients";
import { updateSpaceCover } from "@/lib/data/spaces";
import type { TaskWithAssignee } from "@/lib/data/tasks";
import type { Client, Profile, Space, Task, TaskStatus } from "@/lib/supabase/types";
import { CoverUploader } from "@/components/CoverUploader";
import { Toolbar, type ViewMode, type SortKey } from "@/components/Toolbar";
import { GroupedTableView } from "@/components/views/GroupedTableView";
import { BoardView } from "@/components/views/BoardView";
import { CalendarView } from "@/components/views/CalendarView";
import { ChartView } from "@/components/views/ChartView";
import { TaskPanel } from "@/components/TaskPanel";
import { NewServiceModal } from "@/components/NewServiceModal";
import { useToast } from "@/components/ToastProvider";

export function SpacePageClient({
  space,
  initialClients,
  initialTasks,
  profiles,
  currentUserId,
}: {
  space: Space;
  initialClients: Client[];
  initialTasks: TaskWithAssignee[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const supabase = createClient();
  const { showUndo } = useToast();

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>(initialTasks);
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [modalClient, setModalClient] = useState<Client | "new" | null>(null);

  const filteredTasks = useMemo(() => {
    let list = tasks;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.service?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (assigneeFilter !== "all") list = list.filter((t) => assigneeDisplay(t) === assigneeFilter);

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

  const isFiltering = search.trim() !== "" || statusFilter !== "all" || assigneeFilter !== "all";
  const clientsWithMatches = useMemo(() => {
    if (!isFiltering) return clients;
    const idsWithMatch = new Set(filteredTasks.map((t) => t.client_id));
    return clients.filter((c) => idsWithMatch.has(c.id));
  }, [clients, filteredTasks, isFiltering]);

  const tasksByClient = useMemo(() => {
    const map = new Map<string, TaskWithAssignee[]>();
    filteredTasks.forEach((t) => {
      map.set(t.client_id, [...(map.get(t.client_id) ?? []), t]);
    });
    return map;
  }, [filteredTasks]);

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

  async function handleDeleteClient(clientId: string) {
    const removedClient = clients.find((c) => c.id === clientId);
    const removedTasks = tasks.filter((t) => t.client_id === clientId);
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setTasks((prev) => prev.filter((t) => t.client_id !== clientId));
    await deleteClient(supabase, clientId);

    if (removedClient) {
      showUndo(`Cliente "${removedClient.name}" excluído.`, async () => {
        await restoreClient(supabase, clientId);
        setClients((prev) => [...prev, removedClient].sort((a, b) => a.name.localeCompare(b.name)));
        setTasks((prev) => [...prev, ...removedTasks]);
      });
    }
  }

  function handleTaskCreated(task: Task, client: Client, isNewClient: boolean) {
    if (isNewClient) setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
    const assignee = profiles.find((p) => p.id === task.assignee_id) ?? null;
    setTasks((prev) => [...prev, { ...task, assignee }]);
  }

  return (
    <div>
      <CoverUploader
        folder={`space-${space.id}`}
        coverUrl={space.cover_url}
        onSave={(url) => updateSpaceCover(supabase, space.id, url)}
      />

      <div className="flex items-center justify-between px-6 pt-4">
        <h1 className="text-2xl font-semibold text-neutral-900">{space.name}</h1>
        <button
          onClick={() => setModalClient("new")}
          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          <Plus size={15} /> Novo Serviço
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

      {view === "table" && (
        <GroupedTableView
          clients={clientsWithMatches}
          tasksByClient={tasksByClient}
          onOpenTask={setOpenTaskId}
          onDeleteTask={handleDeleteTask}
          onDeleteClient={handleDeleteClient}
          onAddTaskToClient={(client) => setModalClient(client)}
        />
      )}
      {view === "board" && (
        <BoardView
          tasks={filteredTasks}
          clients={clientsWithMatches}
          onOpenTask={setOpenTaskId}
          onStatusChange={handleStatusChange}
        />
      )}
      {view === "calendar" && <CalendarView tasks={filteredTasks} onOpenTask={setOpenTaskId} />}
      {view === "chart" && <ChartView tasks={filteredTasks} />}

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

      {modalClient && (
        <NewServiceModal
          spaceId={space.id}
          clients={clients}
          profiles={profiles}
          currentUserId={currentUserId}
          fixedClient={modalClient === "new" ? undefined : modalClient}
          onClose={() => setModalClient(null)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
