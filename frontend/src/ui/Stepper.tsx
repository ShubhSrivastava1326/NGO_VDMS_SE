import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/format";

/** Donation steps joined by a thread. `current` is 0-based; `failed` marks the current step as broken. */
export function Stepper({ steps, current, failed, className }: { steps: string[]; current: number; failed?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const last = steps.length - 1;
  const fill = Math.min(1, current / last);
  return (
    <ol className={cn("relative flex items-start justify-between", className)} aria-label="Donation progress">
      {/* track + thread sit behind the nodes */}
      <div className="pointer-events-none absolute left-4 right-4 top-4" aria-hidden="true">
        <div className="stitch-h" />
        <motion.div
          className={cn("absolute left-0 top-1/2 h-[3px] w-full origin-left -translate-y-1/2 rounded-full", failed ? "bg-danger-600" : "bg-berry-700")}
          initial={false}
          animate={{ scaleX: fill }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        const broken = now && failed;
        return (
          <li key={label} className="relative z-10 flex w-24 flex-col items-center gap-2 text-center" aria-current={now ? "step" : undefined}>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full border-[3px] text-sm font-bold transition-colors duration-300",
                done && "border-berry-700 bg-berry-700 text-white",
                now && !broken && "border-berry-700 bg-paper text-berry-700",
                broken && "border-danger-600 bg-danger-50 text-danger-600",
                !done && !now && "border-berry-300 bg-paper text-ink-3",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : broken ? <X className="size-4" strokeWidth={3} aria-hidden="true" /> : <span className="num">{i + 1}</span>}
            </span>
            <span className={cn("text-[0.82rem] font-semibold", now ? "text-ink" : "text-ink-3")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
