import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { ApiError } from "@/api/client";
import { cn } from "@/lib/format";

type Kind = "success" | "error" | "info";
interface ToastItem { id: number; kind: Kind; message: string }

interface ToastApi {
  success: (m: string) => void;
  info: (m: string) => void;
  error: (m: string) => void;
  /** show the message of an ApiError (or any Error) */
  fail: (e: unknown) => void;
}

const Ctx = createContext<ToastApi | null>(null);
export const useToast = (): ToastApi => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
};

const icon = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const tone = {
  success: "border-teal-600/40 text-teal-800 [&_svg]:text-teal-600",
  error: "border-danger-600/40 text-danger-600 [&_svg]:text-danger-600",
  info: "border-line-strong text-ink [&_svg]:text-berry-700",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = next.current++;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 8000 : 5000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m),
    info: (m) => push("info", m),
    error: (m) => push("error", m),
    fail: (e) => push("error", e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong"),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-3 bottom-3 z-[80] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem]">
        {items.map((t) => {
          const Icon = icon[t.kind];
          return (
            <div key={t.id} className={cn("pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] border bg-white px-4 py-3 shadow-[var(--shadow-pop)] animate-[pop-in_0.22s_var(--ease-out-soft)]", tone[t.kind])}>
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-[0.93rem] font-medium text-ink">{t.message}</p>
              <button type="button" aria-label="Dismiss message" onClick={() => dismiss(t.id)} className="-m-1 rounded-full p-1 text-ink-3 hover:bg-blush-100">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
