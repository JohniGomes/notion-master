import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSpaces } from "@/lib/data/spaces";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, spaces] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    listSpaces(supabase),
  ]);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-neutral-50">
        <Sidebar spaces={spaces} currentUserId={user.id} userLabel={profile?.full_name || profile?.email || ""} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
