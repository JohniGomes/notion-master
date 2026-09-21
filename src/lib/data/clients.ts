import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "@/lib/supabase/types";

type SB = SupabaseClient;

export async function listClients(supabase: SB, spaceId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getClient(supabase: SB, id: string): Promise<Client | null> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data;
}

export async function createClientRecord(
  supabase: SB,
  name: string,
  createdBy: string,
  spaceId: string
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ name, created_by: createdBy, space_id: spaceId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateClientCover(supabase: SB, id: string, coverUrl: string) {
  const { error } = await supabase.from("clients").update({ cover_url: coverUrl }).eq("id", id);
  if (error) throw error;
}

export async function renameClient(supabase: SB, id: string, name: string) {
  const { error } = await supabase.from("clients").update({ name }).eq("id", id);
  if (error) throw error;
}

// Exclusão reversível: marca deleted_at no cliente e em todas as suas etapas.
export async function deleteClient(supabase: SB, id: string) {
  const now = new Date().toISOString();
  await supabase.from("tasks").update({ deleted_at: now }).eq("client_id", id);
  const { error } = await supabase.from("clients").update({ deleted_at: now }).eq("id", id);
  if (error) throw error;
}

export async function restoreClient(supabase: SB, id: string) {
  await supabase.from("tasks").update({ deleted_at: null }).eq("client_id", id);
  const { error } = await supabase.from("clients").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}
