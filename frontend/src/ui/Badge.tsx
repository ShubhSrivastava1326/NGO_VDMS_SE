import type { ReactNode } from "react";
import { cn, titleCase } from "@/lib/format";

type Tone = "neutral" | "berry" | "teal" | "amber" | "danger";

const tones: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-blush-50 text-ink-2 border-line-strong", dot: "bg-ink-3" },
  berry: { box: "bg-blush-100 text-berry-800 border-blush-300", dot: "bg-berry-600" },
  teal: { box: "bg-teal-50 text-teal-800 border-teal-600/30", dot: "bg-teal-600" },
  amber: { box: "bg-amber-50 text-amber-700 border-amber-700/30", dot: "bg-amber-700" },
  danger: { box: "bg-danger-50 text-danger-600 border-danger-600/30", dot: "bg-danger-600" },
};

/** Status is always shown as text + a dot, never colour alone. */
const statusMap: Record<string, { tone: Tone; label?: string }> = {
  // campaign
  draft: { tone: "neutral", label: "Draft" },
  active: { tone: "teal", label: "Active" },
  closed: { tone: "neutral", label: "Closed" },
  // donation
  pending: { tone: "amber", label: "Pending" },
  completed: { tone: "teal", label: "Completed" },
  failed: { tone: "danger", label: "Failed" },
  // event
  published: { tone: "teal", label: "Published" },
  cancelled: { tone: "danger", label: "Cancelled" },
  // volunteer
  approved: { tone: "teal", label: "Approved" },
  deactivated: { tone: "neutral", label: "Deactivated" },
  // attendance
  registered: { tone: "berry", label: "Registered" },
  attended: { tone: "teal", label: "Attended" },
  no_show: { tone: "danger", label: "No-show" },
  // email log
  sent: { tone: "teal", label: "Sent" },
  skipped: { tone: "amber", label: "Not sent (no SMTP)" },
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.78rem] font-semibold leading-5 whitespace-nowrap", t.box, className)}>
      <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = statusMap[status] ?? { tone: "neutral" as Tone };
  return <Pill tone={s.tone} className={className}>{s.label ?? titleCase(status)}</Pill>;
}

/** Plain label chip (category, role). */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border border-line-strong bg-white px-2.5 py-0.5 text-[0.78rem] font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}
