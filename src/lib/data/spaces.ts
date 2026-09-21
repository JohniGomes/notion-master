import type { SupabaseClient } from "@supabase/supabase-js";
import type { Space } from "@/lib/supabase/types";

type SB = SupabaseClient;

export async function listSpaces(supabase: SB): Promise<Space[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSpace(supabase: SB, id: string): Promise<Space | null> {
  const { data, error } = await supabase.from("spaces").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createSpace(supabase: SB, name: string, createdBy: string): Promise<Space> {
  const { data, error } = await supabase
    .from("spaces")
    .insert({ name, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSpaceCover(supabase: SB, id: string, coverUrl: string) {
  const { error } = await supabase.from("spaces").update({ cover_url: coverUrl }).eq("id", id);
  if (error) throw error;
}

export async function renameSpace(supabase: SB, id: string, name: string) {
  const { error } = await supabase.from("spaces").update({ name }).eq("id", id);
  if (error) throw error;
}

// Exclusão reversível: marca deleted_at em vez de apagar de fato, junto com
// os clientes e etapas dentro do espaço (também reversíveis via restoreSpace).
export async function deleteSpace(supabase: SB, id: string) {
  const now = new Date().toISOString();
  const { data: clientRows } = await supabase.from("clients").select("id").eq("space_id", id);
  const clientIds = (clientRows ?? []).map((c: { id: string }) => c.id);

  if (clientIds.length > 0) {
    await supabase.from("tasks").update({ deleted_at: now }).in("client_id", clientIds);
    await supabase.from("clients").update({ deleted_at: now }).in("id", clientIds);
  }
  const { error } = await supabase.from("spaces").update({ deleted_at: now }).eq("id", id);
  if (error) throw error;
}

export async function restoreSpace(supabase: SB, id: string) {
  const { data: clientRows } = await supabase.from("clients").select("id").eq("space_id", id);
  const clientIds = (clientRows ?? []).map((c: { id: string }) => c.id);

  if (clientIds.length > 0) {
    await supabase.from("tasks").update({ deleted_at: null }).in("client_id", clientIds);
    await supabase.from("clients").update({ deleted_at: null }).in("id", clientIds);
  }
  const { error } = await supabase.from("spaces").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}
