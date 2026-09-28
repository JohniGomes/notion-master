import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceTemplate } from "@/lib/supabase/types";

type SB = SupabaseClient;

export async function listServiceCatalog(supabase: SB): Promise<ServiceTemplate[]> {
  const { data, error } = await supabase
    .from("service_templates")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
