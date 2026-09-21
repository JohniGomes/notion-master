"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus } from "lucide-react";

export function CoverUploader({
  folder,
  coverUrl,
  onSave,
  height = "h-48",
}: {
  /** Prefixo de pasta dentro do bucket "covers" (ex: "client-<id>" ou "space-<id>"). */
  folder: string;
  coverUrl: string | null;
  onSave: (url: string) => Promise<void> | void;
  height?: string;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(coverUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${folder}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("covers").upload(path, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      await onSave(data.publicUrl);
      setUrl(data.publicUrl);
    } catch (err) {
      console.error("Falha ao enviar capa:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido ao enviar a capa.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={`group relative ${height} w-full bg-gradient-to-br from-neutral-200 to-neutral-100 bg-cover bg-center`}
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    >
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 opacity-0 shadow-sm transition group-hover:opacity-100"
      >
        <ImagePlus size={14} />
        {uploading ? "Enviando..." : url ? "Trocar capa" : "Adicionar capa"}
      </button>
      {error && (
        <p className="absolute bottom-3 left-3 max-w-xs rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
