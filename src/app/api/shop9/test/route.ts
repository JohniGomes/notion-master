import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shop9 } from "@/lib/shop9/client";

// Rota de diagnóstico: confirma que a autenticação e a assinatura HMAC
// contra a API do Shop9 estão funcionando. Não expõe nada sensível além
// do que o próprio Shop9 já retornaria pra um usuário autenticado do app.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const clientes = await shop9.get<unknown[]>("/clientes/1");
    return NextResponse.json({ ok: true, amostraClientes: Array.isArray(clientes) ? clientes.length : 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
