"use client";

import { useEffect } from "react";
import { Undo2 } from "lucide-react";

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  seconds = 8,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  seconds?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, seconds * 1000);
    return () => clearTimeout(timer);
  }, [onDismiss, seconds]);

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button
        onClick={() => {
          onUndo();
          onDismiss();
        }}
        className="flex items-center gap-1 font-medium text-blue-300 hover:text-blue-200"
      >
        <Undo2 size={14} /> Desfazer
      </button>
    </div>
  );
}
