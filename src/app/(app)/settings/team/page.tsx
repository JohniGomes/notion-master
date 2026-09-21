import { createClient } from "@/lib/supabase/server";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { TeamMembersList } from "@/components/TeamMembersList";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Equipe</h1>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Convidar novo membro</h2>
        <InviteMemberForm />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700">
          Membros <span className="font-normal text-neutral-400">(clique no nome para editar)</span>
        </h2>
        <TeamMembersList initialProfiles={profiles ?? []} />
      </div>
    </div>
  );
}
