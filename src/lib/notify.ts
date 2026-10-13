// Fire-and-forget: avisa a equipe por e-mail quando uma etapa muda de status.
// Nunca deve travar a UI nem propagar erro — a atualização de status já aconteceu.
export function notifyStatusChange(taskId: string) {
  fetch("/api/notify/status-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  }).catch(() => {});
}

// Avisa a equipe por e-mail quando uma atividade (ou servico com varias etapas) e criada.
export function notifyTasksCreated(taskIds: string[]) {
  if (taskIds.length === 0) return;
  fetch("/api/notify/task-created", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  }).catch(() => {});
}
