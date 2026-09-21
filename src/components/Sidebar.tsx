"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus, Home, Users, LogOut, Trash2 } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { createSpace, deleteSpace, restoreSpace } from "@/lib/data/spaces";
import type { Space } from "@/lib/supabase/types";
import { useToast } from "@/components/ToastProvider";

export function Sidebar({
  spaces: initialSpaces,
  currentUserId,
  userLabel,
}: {
  spaces: Space[];
  currentUserId: string;
  userLabel: string;
}) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [collapsed, setCollapsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { showUndo } = useToast();

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const space = await createSpace(supabase, newName.trim(), currentUserId);
    setSpaces((prev) => [...prev, space]);
    setNewName("");
    setCreating(false);
    router.push(`/spaces/${space.id}`);
    router.refresh();
  }

  async function handleDeleteSpace(space: Space) {
    if (space.is_default) return;
    if (!confirm(`Excluir o espaço "${space.name}" e todos os clientes/etapas dentro dele?`)) return;

    const wasActive = pathname === `/spaces/${space.id}`;
    const remaining = spaces.filter((s) => s.id !== space.id);
    setSpaces(remaining);
    await deleteSpace(supabase, space.id);

    if (wasActive) {
      router.push(remaining[0] ? `/spaces/${remaining[0].id}` : "/");
    }
    router.refresh();

    showUndo(`Espaço "${space.name}" excluído.`, async () => {
      await restoreSpace(supabase, space.id);
      setSpaces((prev) => [...prev, space].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      router.push(`/spaces/${space.id}`);
      router.refresh();
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="flex h-screen w-12 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
          title="Expandir menu"
        >
          <PanelLeftOpen size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Image src="/logo.png" alt="Master" width={24} height={24} className="h-6 w-6 shrink-0 rounded object-contain" />
        <span className="truncate text-sm font-semibold text-neutral-800">Gestão de Tarefas da Master</span>
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="truncate text-sm font-medium text-neutral-700">{userLabel}</span>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
          title="Recolher menu"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <Link
          href="/settings/team"
          className={clsx(
            "mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/70",
            pathname === "/settings/team" ? "bg-neutral-200/70 font-medium text-neutral-900" : "text-neutral-600"
          )}
        >
          <Users size={15} /> Equipe
        </Link>

        <div className="mt-3 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Espaços</span>
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-neutral-400 hover:text-neutral-700"
            title="Novo espaço"
          >
            <Plus size={14} />
          </button>
        </div>

        {creating && (
          <form onSubmit={handleCreateSpace} className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName.trim() && setCreating(false)}
              placeholder="Nome do espaço"
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-900"
            />
          </form>
        )}

        <ul className="mt-1 space-y-0.5">
          {spaces.map((space) => {
            const href = `/spaces/${space.id}`;
            const active = pathname === href;
            return (
              <li key={space.id} className="group flex items-center">
                <Link
                  href={href}
                  className={clsx(
                    "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/70",
                    active ? "bg-neutral-200/70 font-medium text-neutral-900" : "text-neutral-600"
                  )}
                >
                  <Home size={15} />
                  <span className="truncate">{space.name}</span>
                </Link>
                {!space.is_default && (
                  <button
                    onClick={() => handleDeleteSpace(space)}
                    className="mr-1 text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                    title="Excluir espaço"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-neutral-200 px-3 py-2">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <LogOut size={15} /> Sair
        </button>
      </div>
    </div>
  );
}
