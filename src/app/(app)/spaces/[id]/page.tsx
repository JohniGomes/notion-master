import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSpace } from "@/lib/data/spaces";
import { listClients } from "@/lib/data/clients";
import { listTasksBySpace } from "@/lib/data/tasks";
import { listServiceCatalog } from "@/lib/data/serviceCatalog";
import { loadCommercialData, loadFinanceData, loadPeopleData } from "@/lib/data/shop9";
import { SpacePageClient } from "@/components/SpacePageClient";
import { DashboardTabs } from "@/components/dashboards/DashboardTabs";

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const space = await getSpace(supabase, id);
  if (!space) notFound();

  if (space.kind === "dashboards") {
    const [commercial, contas, tasks] = await Promise.all([
      loadCommercialData(supabase),
      // Tolerante: ate a migration 09 ser aplicada, o financeiro aparece vazio.
      loadFinanceData(supabase).catch(() => []),
      loadPeopleData(supabase),
    ]);
    return (
      <div>
        <h1 className="px-6 pt-6 text-2xl font-semibold text-neutral-900">{space.name}</h1>
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
