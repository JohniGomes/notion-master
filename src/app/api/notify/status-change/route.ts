import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/components/status";
import { sendEmail } from "@/lib/email";
import type { TaskStatus } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { taskId } = await request.json();
  if (!taskId || typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId inválido." }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, service, os_number, status, client:clients(id, name)")
    .eq("id", taskId)
    .single();
  if (taskError || !task) {
    return NextResponse.json({ error: "Etapa não encontrada." }, { status: 404 });
  }

  const { data: profiles } = await supabase.from("profiles").select("email").not("email", "is", null);
  const recipients = (profiles ?? []).map((p) => p.email as string).filter(Boolean);

  const client = Array.isArray(task.client) ? task.client[0] : task.client;
  const statusLabel = STATUS_LABEL[task.status as TaskStatus] ?? task.status;
  const osLabel = task.os_number != null ? ` (O.S ${task.os_number})` : "";

  try {
    await sendEmail({
      to: recipients,
      subject: `${client?.name ?? "Cliente"}${osLabel} — "${task.title}" agora está ${statusLabel}`,
      html: `
        <p><strong>${client?.name ?? "Cliente"}${osLabel}</strong></p>
        <p>A etapa <strong>${task.title}</strong>${task.service ? ` (${task.service})` : ""} mudou de status para <strong>${statusLabel}</strong>.</p>
      `,
    });
  } catch (err) {
    // Falha de e-mail não deve quebrar a atualização de status já feita pelo cliente.
    console.error("notify/status-change:", err);
  }

  return NextResponse.json({ ok: true });
}
