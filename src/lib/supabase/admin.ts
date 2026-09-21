import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// NUNCA importe este módulo em um Client Component — a service_role key
// ignora o RLS e só pode existir no servidor (Route Handlers / Server Actions).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
