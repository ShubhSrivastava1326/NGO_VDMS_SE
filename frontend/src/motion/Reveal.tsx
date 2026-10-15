import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/format";

/** Fade + small rise once when scrolled into view. Used sparingly, never on forms or errors. */
export function Reveal({ children, delay = 0, y = 16, className, as = "div" }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" | "article";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -4% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}

/**
 * Headline words rise out of a mask, one after another. The real text stays in the DOM
 * (as visually-hidden text) so screen readers and copy/paste are unaffected.
 */
export function RiseWords({ text, className, delay = 0, step = 0.07, emphasis }: {
  text: string; className?: string; delay?: number; step?: number; emphasis?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={cn("block", emphasis && "emph", className)}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.14em] align-bottom [margin-bottom:-0.14em]">
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "108%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: delay + i * step, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}{i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
