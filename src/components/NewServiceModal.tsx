"use client";

import { useRef, useState } from "react";
import { X, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createClientRecord } from "@/lib/data/clients";
import { addAttachment, createTask } from "@/lib/data/tasks";
import type { Client, Profile, Task, TaskStatus } from "@/lib/supabase/types";
import { STATUS_LABEL, STATUS_ORDER } from "@/components/status";
import { AssigneeInput } from "@/components/AssigneeInput";

export function NewServiceModal({
  spaceId,
  clients,
  profiles,
  currentUserId,
  fixedClient,
  onClose,
  onCreated,
}: {
  spaceId: string;
  clients: Client[];
  profiles: Profile[];
  currentUserId: string;
  /** Quando aberto a partir de um cliente específico, pula a etapa de escolher/criar cliente. */
  fixedClient?: Client;
  onClose: () => void;
  onCreated: (task: Task, client: Client, isNewClient: boolean) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientName, setClientName] = useState(fixedClient?.name ?? "");
  const [etapa, setEtapa] = useState("");
  const [servico, setServico] = useState("");
  const [osNumber, setOsNumber] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [observation, setObservation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !etapa.trim()) {
      setError("Preencha ao menos o cliente e a etapa.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let client = fixedClient;
      let isNewClient = false;

      if (!client) {
        const existing = clients.find(
          (c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase()
        );
        if (existing) {
          client = existing;
        } else {
          client = await createClientRecord(supabase, clientName.trim(), currentUserId, spaceId);
          isNewClient = true;
        }
      }

      const task = await createTask(supabase, {
        clientId: client.id,
        title: etapa.trim(),
        service: servico.trim() || null,
        osNumber: osNumber ? Number(osNumber) : null,
        status,
        createdBy: currentUserId,
      });

      const patch: Partial<Task> = {};
      if (assigneeId) patch.assignee_id = assigneeId;
      if (assigneeName) patch.assignee_name = assigneeName;
      if (dueDate) patch.due_date = dueDate;
      if (observation.trim()) patch.observation = observation.trim();
      if (Object.keys(patch).length > 0) {
        await supabase.from("tasks").update(patch).eq("id", task.id);
        Object.assign(task, patch);
      }

      for (const file of files) {
        const path = `${task.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
        if (!uploadError) {
          await addAttachment(supabase, task.id, currentUserId, file.name, path);
        }
      }

      onCreated(task, client, isNewClient);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-semibold text-neutral-900">Novo serviço</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <Field label="Cliente" required>
            {fixedClient ? (
              <input
                disabled
                value={fixedClient.name}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500"
              />
            ) : (
              <>
                <input
                  list="client-options"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome do cliente (novo ou existente)"
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
                />
                <datalist id="client-options">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field label="Etapa" required>
            <input
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              placeholder="Ex: Topografia"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
          </Field>

          <Field label="Serviço">
            <input
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              placeholder="Ex: Usucapião Extrajudicial"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="O.S">
              <input
                type="number"
                value={osNumber}
                onChange={(e) => setOsNumber(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
              />
            </Field>
            <Field label="Data limite">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsável">
              <AssigneeInput
                profiles={profiles}
                assigneeId={assigneeId}
                assigneeName={assigneeName}
                onChange={(v) => {
                  setAssigneeId(v.assigneeId);
                  setAssigneeName(v.assigneeName);
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
              />
            </Field>
          </div>

          <Field label="Observação">
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
          </Field>

          <Field label="Anexos">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-neutral-400"
            >
              <Paperclip size={13} />
              {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar arquivos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
