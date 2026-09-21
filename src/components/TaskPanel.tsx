"use client";

import { useEffect, useRef, useState } from "react";
import { X, Paperclip, Send, Trash2, Trash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addAttachment,
  addComment,
  deleteAttachment,
  listAttachments,
  listComments,
  updateTask,
} from "@/lib/data/tasks";
import type { Attachment, Comment, Profile, TaskStatus } from "@/lib/supabase/types";
import type { TaskWithAssignee } from "@/lib/data/tasks";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_LABEL, STATUS_ORDER } from "@/components/status";
import { AssigneeInput } from "@/components/AssigneeInput";

export function TaskPanel({
  task,
  profiles,
  currentUserId,
  onClose,
  onTaskUpdated,
  onDeleteTask,
}: {
  task: TaskWithAssignee;
  profiles: Profile[];
  currentUserId: string;
  onClose: () => void;
  onTaskUpdated: (patch: Partial<TaskWithAssignee>) => void;
  onDeleteTask?: (taskId: string) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<(Comment & { author: Profile | null })[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [observation, setObservation] = useState(task.observation ?? "");
  const [service, setService] = useState(task.service ?? "");
  const [osNumber, setOsNumber] = useState(task.os_number != null ? String(task.os_number) : "");

  useEffect(() => {
    listComments(supabase, task.id).then(setComments);
    listAttachments(supabase, task.id).then(setAttachments);
    setObservation(task.observation ?? "");
    setService(task.service ?? "");
    setOsNumber(task.os_number != null ? String(task.os_number) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function handleStatusChange(status: TaskStatus) {
    await updateTask(supabase, task.id, { status });
    onTaskUpdated({ status });
  }

  async function handleAssigneeInputChange(value: { assigneeId: string | null; assigneeName: string | null }) {
    await updateTask(supabase, task.id, { assignee_id: value.assigneeId, assignee_name: value.assigneeName });
    const assignee = profiles.find((p) => p.id === value.assigneeId) ?? null;
    onTaskUpdated({ assignee_id: value.assigneeId, assignee_name: value.assigneeName, assignee } as Partial<TaskWithAssignee>);
  }

  async function handleDueDateChange(dueDate: string) {
    await updateTask(supabase, task.id, { due_date: dueDate || null });
    onTaskUpdated({ due_date: dueDate || null });
  }

  async function handleObservationBlur() {
    await updateTask(supabase, task.id, { observation: observation || null });
    onTaskUpdated({ observation: observation || null });
  }

  async function handleServiceBlur() {
    await updateTask(supabase, task.id, { service: service.trim() || null });
    onTaskUpdated({ service: service.trim() || null });
  }

  async function handleOsBlur() {
    const value = osNumber.trim() ? Number(osNumber) : null;
    await updateTask(supabase, task.id, { os_number: value });
    onTaskUpdated({ os_number: value });
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    await addComment(supabase, task.id, currentUserId, newComment.trim());
    setNewComment("");
    setComments(await listComments(supabase, task.id));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${task.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (!error) {
      await addAttachment(supabase, task.id, currentUserId, file.name, path);
      setAttachments(await listAttachments(supabase, task.id));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDownload(att: Attachment) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(att.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteAttachment(att: Attachment) {
    await deleteAttachment(supabase, att.id, att.storage_path);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-semibold text-neutral-900">{task.title}</h2>
          <div className="flex items-center gap-3">
            {onDeleteTask && (
              <button
                onClick={() => {
                  if (confirm(`Excluir a etapa "${task.title}"?`)) onDeleteTask(task.id);
                }}
                className="text-neutral-400 hover:text-red-500"
                title="Excluir etapa"
              >
                <Trash size={16} />
              </button>
            )}
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4 border-b border-neutral-200 px-5 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Status</span>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Responsável</span>
            <AssigneeInput
              profiles={profiles}
              assigneeId={task.assignee_id}
              assigneeName={task.assignee_name}
              onChange={handleAssigneeInputChange}
              className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-sm text-right outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Data limite</span>
            <input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Serviço</span>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              onBlur={handleServiceBlur}
              className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-sm text-right outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">O.S</span>
            <input
              type="number"
              value={osNumber}
              onChange={(e) => setOsNumber(e.target.value)}
              onBlur={handleOsBlur}
              className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm text-right outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-neutral-500">Observação</label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              onBlur={handleObservationBlur}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <Paperclip size={14} /> Anexos
          </h3>
          <div className="space-y-1">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-2 py-1.5 text-sm">
                <button onClick={() => handleDownload(att)} className="truncate text-left text-neutral-700 hover:underline">
                  {att.file_name}
                </button>
                <button onClick={() => handleDeleteAttachment(att)} className="text-neutral-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-neutral-400"
          >
            + Adicionar arquivo
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>

        <div className="flex flex-1 flex-col px-5 py-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-700">Comentários</h3>
          <div className="flex-1 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="font-medium text-neutral-800">{c.author?.full_name || c.author?.email}</p>
                <p className="text-neutral-600">{c.body}</p>
                <p className="text-[11px] text-neutral-400">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-neutral-400">Nenhum comentário ainda.</p>}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder="Escreva um comentário..."
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
            <button onClick={handleAddComment} className="rounded-md bg-neutral-900 p-2 text-white hover:bg-neutral-700">
              <Send size={14} />
            </button>
          </div>
        </div>

        {task.status && (
          <div className="px-5 pb-4">
            <StatusBadge status={task.status} />
          </div>
        )}
      </div>
    </div>
  );
}
