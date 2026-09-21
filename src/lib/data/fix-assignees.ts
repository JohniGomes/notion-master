/**
 * Script único: preenche assignee_name nas tarefas já migradas usando os dados
 * originais da planilha (supabase/seed-data.json), casando por cliente + etapa + O.S.
 * Rode com: npx tsx src/lib/data/fix-assignees.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalize(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

type SeedItem = { os: number | null; etapa: string; responsavel: string };
type SeedGroup = { display: string; items: SeedItem[] };
type SeedFile = Record<string, SeedGroup>;

async function main() {
  const raw = readFileSync(resolve(__dirname, "../../../supabase/seed-data.json"), "utf-8");
  const groups: SeedFile = JSON.parse(raw);

  // key: normalized(clientName)|normalized(etapa)|os -> responsavel
  const lookup = new Map<string, string>();
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    for (const item of g.items) {
      if (!item.responsavel) continue;
      const k = `${normalize(g.display)}|${normalize(item.etapa)}|${item.os ?? ""}`;
      lookup.set(k, item.responsavel);
    }
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, os_number, client:clients(name)");
  if (error) throw error;

  let updated = 0;
  for (const t of tasks as unknown as { id: string; title: string; os_number: number | null; client: { name: string } | null }[]) {
    if (!t.client) continue;
    const k = `${normalize(t.client.name)}|${normalize(t.title)}|${t.os_number ?? ""}`;
    const responsavel = lookup.get(k);
    if (!responsavel) continue;

    const { error: updErr } = await supabase.from("tasks").update({ assignee_name: responsavel }).eq("id", t.id);
    if (!updErr) updated++;
  }

  console.log(`Concluído: ${updated} de ${tasks?.length ?? 0} etapas atualizadas com responsável.`);
}

main();
