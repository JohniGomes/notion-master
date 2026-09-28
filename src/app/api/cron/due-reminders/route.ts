import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Roda 1x por dia (ver vercel.json). Avisa a equipe sobre etapas com vencimento amanhã.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDate = tomorrow.toISOString().slice(0, 10);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, service, os_number, client:clients(name)")
    .eq("due_date", dueDate)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: profiles } = await admin.from("profiles").select("email").not("email", "is", null);
  const recipients = (profiles ?? []).map((p) => p.email as string).filter(Boolean);

  const items = tasks
    .map((t) => {
      const client = Array.isArray(t.client) ? t.client[0] : t.client;
      const osLabel = t.os_number != null ? ` (O.S ${t.os_number})` : "";
      return `<li><strong>${client?.name ?? "Cliente"}${osLabel}</strong> — ${t.title}${t.service ? ` (${t.service})` : ""}</li>`;
    })
    .join("");

  try {
    await sendEmail({
      to: recipients,
      subject: `${tasks.length} etapa(s) vencendo amanhã`,
      html: `
        <p>As etapas abaixo vencem amanhã (${dueDate.split("-").reverse().join("/")}):</p>
        <ul>${items}</ul>
      `,
    });
  } catch (err) {
    console.error("cron/due-reminders:", err);
    return NextResponse.json({ error: "Falha ao enviar e-mail." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: tasks.length });
}
