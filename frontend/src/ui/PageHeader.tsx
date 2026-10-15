import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/format";

export function PageHeader({ folio, title, description, actions, back, className }: {
  folio?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6", className)}>
      <div className="min-w-0 max-w-3xl">
        {back && (
          <Link to={back.to} className="folio mb-3 inline-flex items-center gap-1 hover:text-berry-700">
            <ChevronLeft className="size-3.5" aria-hidden="true" />{back.label}
          </Link>
        )}
        {folio && <p className="folio mb-2">{folio}</p>}
        <h1 className="text-[clamp(1.9rem,4vw,2.9rem)]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** Ledger-style figure: mono label above a large number. */
export function Stat({ label, value, hint, tone = "ink", className }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: "ink" | "berry" | "teal"; className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="folio">{label}</p>
      <p className={cn("display mt-1 text-[clamp(1.7rem,3vw,2.35rem)] tabular-nums", tone === "berry" && "text-berry-700", tone === "teal" && "text-teal-800")}>{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
    </div>
  );
}

/** Section heading used inside dashboards: folio + title + optional right-hand action. */
export function SectionHead({ title, folio, action }: { title: string; folio?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {folio && <p className="folio mb-1">{folio}</p>}
        <h2 className="text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
