import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shop9Conta, Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";

type SB = SupabaseClient;

// O Supabase devolve no maximo 1000 linhas por consulta; percorre em paginas.
// A ordenacao e obrigatoria: sem ela a paginacao pode repetir ou perder linhas.
async function fetchAll<T>(
  supabase: SB,
  table: string,
  columns: string,
  orderBy: string,
  onlyActive = false
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns);
    if (onlyActive) query = query.is("deleted_at", null);
    const { data, error } = await query.order(orderBy).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadCommercialData(supabase: SB) {
  const [os, itens, situacoes, tipos] = await Promise.all([
    fetchAll<Shop9Os>(
      supabase,
      "shop9_os",
      "ordem, numero, ordem_movimento, cliente, tipo_ordem, situacao_ordem, aprovado, fechada, cancelada, valor_total, data_gravacao, prazo",
      "ordem"
    ),
    fetchAll<Shop9OsItem>(
      supabase,
      "shop9_os_itens",
      "ordem, ordem_movimento, servico_codigo, servico_nome, preco_final, tecnico",
      "ordem"
    ),
    fetchAll<Shop9Lookup>(supabase, "shop9_situacoes", "ordem, nome, final", "ordem"),
    fetchAll<Shop9Lookup>(supabase, "shop9_tipos_os", "ordem, nome", "ordem"),
  ]);
  return {
    os: os.map((o) => ({ ...o, valor_total: Number(o.valor_total) })),
    itens: itens.map((i) => ({ ...i, preco_final: Number(i.preco_final) })),
    situacoes,
    tipos,
  };
}

export async function loadFinanceData(supabase: SB) {
  const contas = await fetchAll<Shop9Conta>(
    supabase,
    "shop9_contas",
    "ordem, pagar_receber, situacao, data_vencimento, data_quitacao, valor_total, valor_quitado, valor_pendente, plano_codigo, plano_nome, servicos",
    "ordem"
  );
  return contas.map((c) => ({
    ...c,
    valor_total: Number(c.valor_total),
    valor_quitado: Number(c.valor_quitado),
    valor_pendente: Number(c.valor_pendente),
  }));
}

export type PeopleTask = {
  id: string;
  cliente: string;
  os: number | null;
  servico: string | null;
  etapa: string;
  status: "not_started" | "in_progress" | "done";
  responsavel: string;
};

// Resumo da Gestao de Tarefas (todas as etapas ativas), para a aba Pessoas.
export async function loadPeopleData(supabase: SB): Promise<PeopleTask[]> {
  type TaskRow = {
    id: string;
    client_id: string;
    title: string;
    service: string | null;
    os_number: number | null;
    status: PeopleTask["status"];
    assignee_id: string | null;
    assignee_name: string | null;
  };
  const [tasks, clients, profiles] = await Promise.all([
    fetchAll<TaskRow>(
      supabase,
      "tasks",
      "id, client_id, title, service, os_number, status, assignee_id, assignee_name",
      "id",
      true
    ),
    fetchAll<{ id: string; name: string }>(supabase, "clients", "id, name", "id", true),
    fetchAll<{ id: string; full_name: string | null; email: string | null }>(
      supabase,
      "profiles",
      "id, full_name, email",
      "id"
    ),
  ]);

  const clientName = new Map(clients.map((c) => [c.id, c.name.trim()]));
  const profileName = new Map(profiles.map((p) => [p.id, p.full_name || p.email || ""]));

  return tasks.map((t) => ({
    id: t.id,
    cliente: clientName.get(t.client_id) ?? "—",
    os: t.os_number,
    servico: t.service,
    etapa: t.title,
    status: t.status,
    responsavel:
      (t.assignee_id ? profileName.get(t.assignee_id) : "") || t.assignee_name?.trim() || "Não atribuído",
  }));
}
