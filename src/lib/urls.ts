/**
 * Enderecos absolutos para usar nos e-mails.
 *
 * Os e-mails rodam no servidor (cron e rotas de notificacao), entao nao da
 * para montar URL relativa: precisa do dominio completo. APP_URL aponta para
 * o dominio proprio e e lida em tempo de execucao — mudar o dominio nao exige
 * rebuild. O fallback para VERCEL_URL serve aos deploys de preview.
 */
export function appUrl(): string {
  const configurado = process.env.APP_URL?.trim();
  if (configurado) return configurado.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/**
 * Link que abre a tarefa ja com o painel lateral dela aberto.
 * O SpacePageClient le ?tarefa= na montagem e abre o painel correspondente.
 */
export function taskUrl(spaceId: string, taskId: string): string {
  return `${appUrl()}/spaces/${spaceId}?tarefa=${taskId}`;
}
