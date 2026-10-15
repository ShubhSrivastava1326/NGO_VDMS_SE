import { useId, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/format";

export interface TabDef { id: string; label: string; count?: number }

/** Accessible tablist (arrow keys, Home/End). A thread underline slides between tabs. */
export function Tabs({ tabs, value, onChange, label, className, panelId }: {
  tabs: TabDef[]; value: string; onChange: (id: string) => void; label: string; className?: string;
  /** id of the element with role="tabpanel" this tablist controls (omit when the tabs only filter a list) */
  panelId?: string;
}) {
  const uid = useId();
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n >= 0) {
      e.preventDefault();
      onChange(tabs[n].id);
      requestAnimationFrame(() => document.getElementById(`${uid}-${tabs[n].id}`)?.focus());
    }
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex gap-1 overflow-x-auto border-b border-line-strong", className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            id={`${uid}-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex min-h-11 items-center gap-2 whitespace-nowrap px-4 text-[0.95rem] font-semibold transition-colors",
              on ? "text-berry-800" : "text-ink-2 hover:text-berry-700",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="num rounded-full bg-blush-100 px-2 text-xs text-berry-800">{t.count}</span>}
            {on && <motion.span layoutId={`${uid}-underline`} className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-berry-700" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}
