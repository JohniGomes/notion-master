import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { buildTaskCreatedEmail, type CreatedTask } from "@/lib/emailTemplates";

type Person = { full_name: string | null; email: string | null };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { taskIds?: unknown } | null;
  const taskIds = Array.isArray(body?.taskIds)
    ? body.taskIds.filter((id): id is string => typeof id === "string").slice(0, 50)
    : [];
  if (taskIds.length === 0) return NextResponse.json({ error: "taskIds inválido." }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("tasks")
    .select(
      "id, title, service, os_number, status, due_date, assignee_name, created_at, client:clients(name, space_id), assignee:profiles!tasks_assignee_id_fkey(full_name, email)"
    )
    .in("id", taskIds)
    .order("created_at", { ascending: true });
  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ error: "Atividades não encontradas." }, { status: 404 });
  }

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const primeiroCliente = one(rows[0].client as { name: string; space_id: string } | { name: string; space_id: string }[] | null);
  const clientName = primeiroCliente?.name ?? "Cliente";
  const tasks: CreatedTask[] = rows.map((r) => {
    const assignee = one(r.assignee as unknown as Person | Person[] | null);
    const cliente = one(r.client as { name: string; space_id: string } | { name: string; space_id: string }[] | null);
    return {
      id: r.id,
      space_id: cliente?.space_id ?? "",
      title: r.title,
      service: r.service,
      os_number: r.os_number,
      status: r.status,
      due_date: r.due_date,
      responsavel: assignee?.full_name || assignee?.email || r.assignee_name || null,
    };
  });

  const [{ data: me }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("profiles").select("email").not("email", "is", null),
  ]);
  const author = me?.full_name || me?.email || "um membro da equipe";
  const recipients = (profiles ?? []).map((p) => p.email as string).filter(Boolean);

  try {
    const { subject, html } = buildTaskCreatedEmail(clientName, tasks, author);
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    // Falha de e-mail nao deve afetar o lancamento ja feito.
    console.error("notify/task-created:", err);
  }

  return NextResponse.json({ ok: true });
}
