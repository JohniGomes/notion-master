import { STATUS_LABEL } from "@/components/status";
import type { TaskStatus } from "@/lib/supabase/types";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type CreatedTask = {
  title: string;
  service: string | null;
  os_number: number | null;
  status: TaskStatus;
  due_date: string | null;
  responsavel: string | null;
};

const dateBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// E-mail unico por lancamento: um servico com varias etapas gera 1 aviso, nao 1 por etapa.
export function buildTaskCreatedEmail(clientName: string, tasks: CreatedTask[], author: string) {
  const first = tasks[0];
  const osLabel = first.os_number != null ? ` (O.S ${first.os_number})` : "";
  const many = tasks.length > 1;
  const service = first.service ?? first.title;

  const items = tasks
    .slice(0, 30)
    .map((t) => {
      const extra = [
        STATUS_LABEL[t.status] ?? t.status,
        t.responsavel ? `resp.: ${t.responsavel}` : null,
        t.due_date ? `prazo: ${dateBr(t.due_date)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li>${escapeHtml(t.title)} <span style="color:#777">— ${escapeHtml(extra)}</span></li>`;
    })
    .join("");
  const more = tasks.length > 30 ? `<p>... e mais ${tasks.length - 30} etapas.</p>` : "";

  const subject = `${clientName}${osLabel} — ${many ? "novo serviço" : "nova atividade"}: ${service}`;
  const html = `
    <p><strong>${escapeHtml(clientName)}${osLabel}</strong></p>
    <p>${many ? `Novo serviço lançado com <strong>${tasks.length} etapas</strong>` : "Nova atividade lançada"}${
      first.service ? ` — <strong>${escapeHtml(first.service)}</strong>` : ""
    } por ${escapeHtml(author)}.</p>
    <ul>${items}</ul>
    ${more}
  `;
  return { subject, html };
}
