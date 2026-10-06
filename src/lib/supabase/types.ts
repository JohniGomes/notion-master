export type TaskStatus = "not_started" | "in_progress" | "done";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_default: boolean;
  kind: "tasks" | "dashboards";
  restricted_to_email: string | null;
}

export interface Shop9Os {
  ordem: number;
  numero: number | null;
  ordem_movimento: number;
  cliente: string | null;
  tipo_ordem: number | null;
  situacao_ordem: number | null;
  aprovado: boolean;
  fechada: boolean;
  cancelada: boolean;
  valor_total: number;
  data_gravacao: string | null;
  prazo: string | null;
}

export interface Shop9OsItem {
  ordem: number;
  ordem_movimento: number;
  servico_codigo: number | null;
  servico_nome: string | null;
  preco_final: number;
  tecnico: string | null;
}

export interface Shop9Lookup {
  ordem: number;
  nome: string;
  final?: boolean;
}

export interface Client {
  id: string;
  space_id: string;
  name: string;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  client_id: string;
  parent_id: string | null;
  title: string;
  service: string | null;
  os_number: number | null;
  status: TaskStatus;
  assignee_id: string | null;
  /** Nome livre do responsável quando a pessoa não tem conta na plataforma. */
  assignee_name: string | null;
  due_date: string | null;
  observation: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceTemplate {
  code: string;
  name: string;
  parent_code: string | null;
  position: number;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

// Minimal Supabase Database type (hand-written, not generated) so
// createBrowserClient/createServerClient are used untyped (no generated
// Database type) — these interfaces annotate our own data helpers instead.
