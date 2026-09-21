import { createClient } from "@/lib/supabase/server";
import { InviteMemberForm } from "@/components/InviteMemberForm";

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
          Membros
        </h2>
        <ul className="divide-y divide-neutral-100">
          {(profiles ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-medium text-neutral-800">{p.full_name || "Sem nome"}</span>
              <span className="text-neutral-500">{p.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
