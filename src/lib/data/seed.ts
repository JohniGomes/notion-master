/**
 * Popula o banco com os dados já migrados da planilha original.
 * Rode com: npx tsx src/lib/data/seed.ts
 *
 * Usa a service_role key (bypassa RLS) — não roda no navegador, só localmente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedItem = {
  os: number | null;
  servico: string;
  etapa: string;
  status_original: string;
  status_cu: "to do" | "in progress" | "complete";
  responsavel: string;
};
type SeedGroup = { display: string; items: SeedItem[] };
type SeedFile = Record<string, SeedGroup>;

const STATUS_MAP: Record<SeedItem["status_cu"], "not_started" | "in_progress" | "done"> = {
  "to do": "not_started",
  "in progress": "in_progress",
  complete: "done",
};

async function main() {
  const path = resolve(__dirname, "../../../supabase/seed-data.json");
  const raw = readFileSync(path, "utf-8");
  const groups: SeedFile = JSON.parse(raw);

  // Precisa de 1 usuário já existente para ser o "created_by" (o primeiro criado no Supabase Auth).
  const { data: firstProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  if (profileError || !firstProfile) {
    console.error(
      "Nenhum usuário encontrado em `profiles`. Crie o primeiro login (signup) antes de rodar o seed."
    );
    process.exit(1);
  }
  const createdBy = firstProfile.id;

  let clientCount = 0;
  let taskCount = 0;

  for (const key of Object.keys(groups)) {
    const group = groups[key];

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({ name: group.display, created_by: createdBy })
      .select("id")
      .single();

    if (clientError || !client) {
      console.error(`Falha ao criar cliente "${group.display}":`, clientError?.message);
      continue;
    }
    clientCount++;

    const rows = group.items.map((item, index) => {
      const observation =
        item.status_original === "Não se aplica" ? "Etapa não se aplica a este caso (planilha original)" : null;

      return {
        client_id: client.id,
        title: item.etapa,
        service: item.servico || null,
        os_number: item.os ?? null,
        status: STATUS_MAP[item.status_cu],
        observation,
        position: index,
        created_by: createdBy,
      };
    });

    const { error: tasksError } = await supabase.from("tasks").insert(rows);
    if (tasksError) {
      console.error(`Falha ao criar etapas de "${group.display}":`, tasksError.message);
      continue;
    }
    taskCount += rows.length;
  }

  console.log(`Concluído: ${clientCount} clientes, ${taskCount} etapas.`);
}

main();
