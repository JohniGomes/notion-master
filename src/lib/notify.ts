// Fire-and-forget: avisa a equipe por e-mail quando uma etapa muda de status.
// Nunca deve travar a UI nem propagar erro — a atualização de status já aconteceu.
export function notifyStatusChange(taskId: string) {
  fetch("/api/notify/status-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  }).catch(() => {});
}
