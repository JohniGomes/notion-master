import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSpace } from "@/lib/data/spaces";
import { listClients } from "@/lib/data/clients";
import { listTasksBySpace } from "@/lib/data/tasks";
import { SpacePageClient } from "@/components/SpacePageClient";

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const space = await getSpace(supabase, id);
  if (!space) notFound();

  const [clients, tasks, { data: profiles }, {
    data: { user },
  }] = await Promise.all([
    listClients(supabase, id),
    listTasksBySpace(supabase, id),
    supabase.from("profiles").select("*"),
    supabase.auth.getUser(),
  ]);

  return (
    <SpacePageClient
      space={space}
      initialClients={clients}
      initialTasks={tasks}
      profiles={profiles ?? []}
      currentUserId={user!.id}
    />
  );
}
