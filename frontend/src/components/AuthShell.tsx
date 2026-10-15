import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";

/** Continue the community artwork from the landing page into account registration. */
export function AuthShell({ folio, title, points, children }: { folio: string; title: ReactNode; points: string[]; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="container-page grid gap-12 pb-20 pt-10 lg:grid-cols-[1fr_30rem] lg:gap-20 lg:pt-16">
      <div className="relative hidden lg:block">
        <p className="folio">{folio}</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,4.6vw,4.2rem)]">{title}</h1>
        <ul className="mt-8 max-w-md space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-ink-2">
              <Check className="mt-1 size-4 shrink-0 text-berry-700" aria-hidden="true" />{p}
            </li>
          ))}
        </ul>
        <motion.img src="/images/community-hero.webp" width={1536} height={1024} alt="" className="mt-10 w-full"
          initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div>
        <div className="lg:hidden">
          <p className="folio">{folio}</p>
          <h1 className="display mt-3 text-[clamp(2.2rem,9vw,3rem)]">{title}</h1>
        </div>
        <div className="sheet mt-6 p-6 sm:p-8 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}
