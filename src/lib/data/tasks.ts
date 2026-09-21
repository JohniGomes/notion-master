import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskStatus, Profile, Comment, Attachment } from "@/lib/supabase/types";

type SB = SupabaseClient;

export type TaskWithAssignee = Task & { assignee: Profile | null };
export type TaskNode = TaskWithAssignee & { children: TaskNode[] };

export async function listTasksByClient(supabase: SB, clientId: string): Promise<TaskWithAssignee[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TaskWithAssignee[];
}

// Todas as tarefas de todos os clientes de um espaço (usado na tabela unificada do espaço).
export async function listTasksBySpace(supabase: SB, spaceId: string): Promise<TaskWithAssignee[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*), clients!inner(space_id)")
    .eq("clients.space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TaskWithAssignee[];
}

export function assigneeDisplay(task: TaskWithAssignee): string {
  return task.assignee?.full_name || task.assignee?.email || task.assignee_name || "—";
}

// Monta a árvore tarefa -> subtarefas a partir da lista plana.
export function buildTaskTree(tasks: TaskWithAssignee[]): TaskNode[] {
  const byId = new Map<string, TaskNode>();
  tasks.forEach((t) => byId.set(t.id, { ...t, children: [] }));

  const roots: TaskNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export async function createTask(
  supabase: SB,
  input: {
    clientId: string;
    parentId?: string | null;
    title: string;
    service?: string | null;
    osNumber?: number | null;
    status?: TaskStatus;
    createdBy: string;
  }
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: input.clientId,
      parent_id: input.parentId ?? null,
      title: input.title,
      service: input.service ?? null,
      os_number: input.osNumber ?? null,
      status: input.status ?? "not_started",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(supabase: SB, id: string, patch: Partial<Task>) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

// Exclusão reversível: marca deleted_at em vez de apagar de fato.
export async function deleteTask(supabase: SB, id: string) {
  const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreTask(supabase: SB, id: string) {
  const { error } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export async function listComments(supabase: SB, taskId: string): Promise<(Comment & { author: Profile | null })[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, author:profiles(*)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as (Comment & { author: Profile | null })[];
}

export async function addComment(supabase: SB, taskId: string, authorId: string, body: string) {
  const { error } = await supabase.from("comments").insert({ task_id: taskId, author_id: authorId, body });
  if (error) throw error;
}

export async function listAttachments(supabase: SB, taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addAttachment(
  supabase: SB,
  taskId: string,
  uploadedBy: string,
  fileName: string,
  storagePath: string
) {
  const { error } = await supabase
    .from("attachments")
    .insert({ task_id: taskId, uploaded_by: uploadedBy, file_name: fileName, storage_path: storagePath });
  if (error) throw error;
}

export async function deleteAttachment(supabase: SB, id: string, storagePath: string) {
  await supabase.storage.from("attachments").remove([storagePath]);
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;
}
