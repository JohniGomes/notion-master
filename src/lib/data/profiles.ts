import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient;

export async function updateProfileName(supabase: SB, id: string, fullName: string) {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", id);
  if (error) throw error;
}
