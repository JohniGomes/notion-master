"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { UndoToast } from "@/components/UndoToast";

type ToastState = { message: string; onUndo: () => void } | null;

const ToastContext = createContext<{ showUndo: (message: string, onUndo: () => void) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const showUndo = useCallback((message: string, onUndo: () => void) => {
    setToast({ message, onUndo });
  }, []);

  return (
    <ToastContext.Provider value={{ showUndo }}>
      {children}
      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={() => setToast(null)} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}
