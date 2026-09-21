import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { listTasksByClient } from "@/lib/data/tasks";
import { ClientPageClient } from "@/components/ClientPageClient";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const client = await getClient(supabase, id);
  if (!client) notFound();

  const [tasks, { data: profiles }, {
    data: { user },
  }] = await Promise.all([
    listTasksByClient(supabase, id),
    supabase.from("profiles").select("*"),
    supabase.auth.getUser(),
  ]);

  return (
    <ClientPageClient
      client={client}
      initialTasks={tasks}
      profiles={profiles ?? []}
      currentUserId={user!.id}
    />
  );
}
