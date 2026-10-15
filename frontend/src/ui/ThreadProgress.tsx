import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn, inr } from "@/lib/format";

/**
 * Campaign progress drawn as a thread: a stitched track, a solid berry thread that draws in when the
 * element scrolls into view, and a bead at the end. Values come straight from the API
 * (progress_percent, amount_raised, goal_amount); nothing is computed here.
 */
export function ThreadProgress({ percent, raised, goal, size = "md", closed, className, showNumbers = false, label = "Campaign funding progress" }: {
  percent: number; raised: string; goal: string; size?: "sm" | "md" | "lg"; closed?: boolean; className?: string; showNumbers?: boolean; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true }) /* no inset margin: on pages without a footer the last rows would never reach it */;
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(100, percent));
  const target = seen || reduce ? `${p}%` : "0%";
  const t = { duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] as const };
  const bead = size === "lg" ? "size-5" : size === "sm" ? "size-3" : "size-4";

  return (
    <div className={className}>
      <div className="px-2">
        <div
          ref={ref}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p)}
          aria-valuetext={`${inr(raised)} raised of ${inr(goal)} goal, ${Math.round(p)} percent`}
          className={cn("relative", size === "lg" ? "h-6" : size === "sm" ? "h-4" : "h-5")}
        >
          <div className="stitch-h absolute inset-x-0 top-1/2 -translate-y-1/2" />
          <motion.div
            className={cn("absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full", closed ? "bg-ink-3" : "bg-berry-700")}
            initial={{ width: "0%" }}
            animate={{ width: target }}
            transition={t}
          />
          <motion.span
            className={cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-paper", bead, closed ? "border-ink-3" : "border-berry-700")}
            initial={{ left: "0%" }}
            animate={{ left: target }}
            transition={t}
          />
        </div>
      </div>
      {showNumbers && (
        <p className="num mt-2 flex items-baseline justify-between gap-3 text-sm">
          <span><strong className="font-medium text-ink">{inr(raised)}</strong> <span className="text-ink-3">raised</span></span>
          <span className="text-ink-3">of {inr(goal)}</span>
        </p>
      )}
    </div>
  );
}
