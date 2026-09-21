import type { TaskStatus } from "@/lib/supabase/types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  done: "Concluído",
};

export const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "done"];

// Tailwind classes centralizadas — usadas na tabela, no quadro e no gráfico
// para a mesma paleta nunca ficar dessincronizada entre views.
export const STATUS_STYLE: Record<TaskStatus, { badge: string; dot: string; column: string }> = {
  not_started: {
    badge: "bg-neutral-100 text-neutral-600",
    dot: "bg-neutral-400",
    column: "bg-neutral-50",
  },
  in_progress: {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    column: "bg-blue-50/60",
  },
  done: {
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    column: "bg-green-50/60",
  },
};
