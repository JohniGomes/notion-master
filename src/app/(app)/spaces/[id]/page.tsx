import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSpace } from "@/lib/data/spaces";
import { listClients } from "@/lib/data/clients";
import { listTasksBySpace } from "@/lib/data/tasks";
import { listServiceCatalog } from "@/lib/data/serviceCatalog";
import { loadCommercialData, loadFinanceData, loadLastSync, loadPeopleData } from "@/lib/data/shop9";
import { SpacePageClient } from "@/components/SpacePageClient";
import { DashboardTabs } from "@/components/dashboards/DashboardTabs";
import { UltimaAtualizacao } from "@/components/dashboards/UltimaAtualizacao";

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const space = await getSpace(supabase, id);
  if (!space) notFound();

  if (space.kind === "dashboards") {
    const [commercial, contas, tasks, ultimaSync] = await Promise.all([
      loadCommercialData(supabase),
      // Tolerante: ate a migration 09 ser aplicada, o financeiro aparece vazio.
      loadFinanceData(supabase).catch(() => []),
      loadPeopleData(supabase),
      loadLastSync(supabase).catch(() => null),
    ]);
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3 px-6 pt-6">
          <h1 className="text-2xl font-semibold text-neutral-900">{space.name}</h1>
          <UltimaAtualizacao em={ultimaSync} />
        </div>
        <DashboardTabs contas={contas} commercial={commercial} tasks={tasks} />
      </div>
    );
  }

  const [clients, tasks, serviceCatalog, { data: profiles }, {
    data: { user },
  }] = await Promise.all([
    listClients(supabase, id),
    listTasksBySpace(supabase, id),
    listServiceCatalog(supabase),
    supabase.from("profiles").select("*"),
    supabase.auth.getUser(),
  ]);

  return (
    <SpacePageClient
      space={space}
      initialClients={clients}
      initialTasks={tasks}
      profiles={profiles ?? []}
      serviceCatalog={serviceCatalog}
      currentUserId={user!.id}
    />
  );
}
