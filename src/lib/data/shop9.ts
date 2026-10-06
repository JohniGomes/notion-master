import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shop9Lookup, Shop9Os, Shop9OsItem } from "@/lib/supabase/types";

type SB = SupabaseClient;

// O Supabase devolve no maximo 1000 linhas por consulta; percorre em paginas.
async function fetchAll<T>(supabase: SB, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadCommercialData(supabase: SB) {
  const [os, itens, situacoes, tipos] = await Promise.all([
    fetchAll<Shop9Os>(
      supabase,
      "shop9_os",
      "ordem, numero, ordem_movimento, cliente, tipo_ordem, situacao_ordem, aprovado, fechada, cancelada, valor_total, data_gravacao, prazo"
    ),
    fetchAll<Shop9OsItem>(
      supabase,
      "shop9_os_itens",
      "ordem, ordem_movimento, servico_codigo, servico_nome, preco_final, tecnico"
    ),
    fetchAll<Shop9Lookup>(supabase, "shop9_situacoes", "ordem, nome, final"),
    fetchAll<Shop9Lookup>(supabase, "shop9_tipos_os", "ordem, nome"),
  ]);
  const normalized = os.map((o) => ({ ...o, valor_total: Number(o.valor_total) }));
  const normalizedItens = itens.map((i) => ({ ...i, preco_final: Number(i.preco_final) }));
  return { os: normalized, itens: normalizedItens, situacoes, tipos };
}
