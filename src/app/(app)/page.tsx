import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSpaces } from "@/lib/data/spaces";

export default async function HomePage() {
  const supabase = await createClient();
  const spaces = await listSpaces(supabase);

  if (spaces.length > 0) {
    redirect(`/spaces/${spaces[0].id}`);
  }

  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <p className="text-neutral-500">
        Nenhum espaço ainda. Crie o primeiro pelo menu lateral (+ ao lado de &quot;Espaços&quot;).
      </p>
    </div>
  );
}
