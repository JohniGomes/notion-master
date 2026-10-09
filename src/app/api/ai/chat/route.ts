import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadCommercialData, loadFinanceData, loadPeopleData } from "@/lib/data/shop9";
import { askAssistant, type ChatMessage } from "@/lib/ai/gemini";

export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_CHARS = 1500;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Chave do Gemini não configurada no servidor." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Envie uma pergunta." }, { status: 400 });
  }

  try {
    const { reply, toolsUsed } = await askAssistant(messages, async () => {
      const [contas, commercial, tasks] = await Promise.all([
        loadFinanceData(supabase),
        loadCommercialData(supabase),
        loadPeopleData(supabase),
      ]);
      return { contas, commercial, tasks };
    });
    return NextResponse.json({ reply, toolsUsed });
  } catch (err) {
    console.error("ai/chat:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao consultar o assistente." },
      { status: 502 }
    );
  }
}
