import { STATUS_LABEL } from "@/components/status";
import { taskUrl } from "@/lib/urls";
import type { TaskStatus } from "@/lib/supabase/types";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type CreatedTask = {
  id: string;
  space_id: string;
  title: string;
  service: string | null;
  os_number: number | null;
  status: TaskStatus;
  due_date: string | null;
  responsavel: string | null;
};

const dateBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Botao "Abrir etapa" — leva direto ao painel daquela tarefa no sistema. */
export function botaoAbrir(spaceId: string, taskId: string, rotulo = "Abrir etapa") {
  return `<a href="${taskUrl(spaceId, taskId)}" style="display:inline-block;padding:7px 14px;background:#74500E;color:#fff;border-radius:6px;text-decoration:none;font-size:13px">${rotulo} &rarr;</a>`;
}

/** Link discreto, para usar dentro de listas. */
export function linkAbrir(spaceId: string, taskId: string, rotulo = "abrir") {
  return `<a href="${taskUrl(spaceId, taskId)}" style="color:#74500E;font-size:13px">${rotulo} &rarr;</a>`;
}

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
      return `<li>${escapeHtml(t.title)} <span style="color:#777">— ${escapeHtml(extra)}</span> ${linkAbrir(t.space_id, t.id)}</li>`;
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

export type OverdueTask = {
  id: string;
  space_id: string;
  title: string;
  service: string | null;
  os_number: number | null;
  status: TaskStatus;
  due_date: string;
  responsavel: string | null;
  cliente: string;
};

/**
 * Resumo diario das etapas vencidas, agrupado por cliente + O.S — a mesma
 * divisao que a equipe ve no painel. O grupo mais atrasado vem primeiro.
 */
export function buildOverdueEmail(tasks: OverdueTask[], hoje: Date) {
  const diasDeAtraso = (iso: string) =>
    Math.max(
      1,
      Math.round(
        (Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()) -
          Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) /
          86_400_000,
      ),
    );

  const grupos = new Map<string, { cliente: string; os: number | null; itens: OverdueTask[] }>();
  for (const t of tasks) {
    const chave = `${t.cliente}__${t.os_number ?? "sem-os"}`;
    const grupo = grupos.get(chave) ?? { cliente: t.cliente, os: t.os_number, itens: [] };
    grupo.itens.push(t);
    grupos.set(chave, grupo);
  }

  const ordenados = [...grupos.values()]
    .map((g) => ({
      ...g,
      itens: [...g.itens].sort((a, b) => a.due_date.localeCompare(b.due_date)),
      pior: Math.max(...g.itens.map((i) => diasDeAtraso(i.due_date))),
    }))
    .sort((a, b) => b.pior - a.pior);

  const blocos = ordenados
    .map((g) => {
      const osLabel = g.os != null ? ` <span style="color:#8A6A2F">· O.S ${g.os}</span>` : "";
      const linhas = g.itens
        .map((t) => {
          const dias = diasDeAtraso(t.due_date);
          const detalhe = [
            STATUS_LABEL[t.status] ?? t.status,
            t.responsavel ? `resp.: ${t.responsavel}` : "sem responsável",
          ].join(" · ");
          return `
            <tr>
              <td style="padding:7px 12px 7px 0;vertical-align:top">${escapeHtml(t.title)}
                <div style="color:#8a8a8a;font-size:13px">${escapeHtml(detalhe)} · ${linkAbrir(t.space_id, t.id)}</div>
              </td>
              <td style="padding:7px 0;text-align:right;white-space:nowrap;vertical-align:top">
                <span style="color:#C0392B;font-weight:600">${dias} ${dias === 1 ? "dia" : "dias"}</span>
                <div style="color:#8a8a8a;font-size:13px">venceu ${dateBr(t.due_date)}</div>
              </td>
            </tr>`;
        })
        .join("");

      return `
        <div style="margin:0 0 22px 0;padding:14px 16px;border:1px solid #ececec;border-radius:10px">
          <div style="font-weight:700;margin-bottom:8px">${escapeHtml(g.cliente)}${osLabel}</div>
          <table style="width:100%;border-collapse:collapse;font-size:15px">${linhas}</table>
        </div>`;
    })
    .join("");

  const totalEtapas = tasks.length;
  const totalGrupos = ordenados.length;
  const subject = `${totalGrupos} O.S com etapa vencida (${totalEtapas} no total)`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:640px">
      <p style="font-size:17px;margin:0 0 4px 0">
        <strong>${totalGrupos}</strong> ${totalGrupos === 1 ? "O.S está" : "O.S estão"} com prazo vencido,
        somando <strong>${totalEtapas}</strong> ${totalEtapas === 1 ? "etapa" : "etapas"}.
      </p>
      <p style="color:#8a8a8a;margin:0 0 20px 0;font-size:14px">
        Da mais atrasada para a menos atrasada.
      </p>
      ${blocos}
    </div>`;

  return { subject, html };
}
