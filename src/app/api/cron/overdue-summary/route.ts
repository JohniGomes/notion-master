import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildOverdueEmail, type OverdueTask } from "@/lib/emailTemplates";

// Roda 1x por dia (ver vercel.json). Resume para a equipe as etapas que ja
// passaram do prazo e ainda nao foram concluidas, agrupadas por cliente + O.S.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  // o cron roda em UTC; o corte precisa ser o "hoje" de Aracruz (UTC-3)
  const agora = new Date();
  const hoje = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const corte = hoje.toISOString().slice(0, 10);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(
      "id, title, service, os_number, status, due_date, assignee_name, client:clients(name, space_id), assignee:profiles!tasks_assignee_id_fkey(full_name, email)",
    )
    .lt("due_date", corte)
    .neq("status", "done")
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    // nada vencido: nao manda e-mail, para o aviso nao virar ruido diario
    return NextResponse.json({ ok: true, vencidas: 0, sent: 0 });
  }

  const vencidas: OverdueTask[] = tasks.map((t) => {
    const client = Array.isArray(t.client) ? t.client[0] : t.client;
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
    return {
      id: t.id,
      space_id: client?.space_id ?? "",
      title: t.title,
      service: t.service,
      os_number: t.os_number,
      status: t.status,
      due_date: t.due_date as string,
      responsavel: assignee?.full_name || assignee?.email || t.assignee_name || null,
      cliente: client?.name ?? "Cliente",
    };
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("email")
    .not("email", "is", null);
  const recipients = (profiles ?? []).map((p) => p.email as string).filter(Boolean);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, vencidas: vencidas.length, sent: 0 });
  }

  const { subject, html } = buildOverdueEmail(vencidas, hoje);

  try {
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    console.error("cron/overdue-summary:", err);
    return NextResponse.json({ error: "Falha ao enviar e-mail." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    vencidas: vencidas.length,
    sent: recipients.length,
  });
}
