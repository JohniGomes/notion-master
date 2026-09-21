import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Só um usuário já autenticado pode convidar outros.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const redirectTo = `${request.nextUrl.origin}/accept-invite`;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
