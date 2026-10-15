import { Link } from "react-router-dom";
import { cn } from "@/lib/format";

/** A single open heart, drawn as two hands meeting. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <path d="M20 34S3.5 23.6 3.5 13.4C3.5 4.6 14 2 20 11.3 26 2 36.5 4.6 36.5 13.4 36.5 23.6 20 34 20 34Z" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 11.3c-4 5.1-4 8.6-1.3 10.1 2.2 1.2 4.2-1.4 3.2-4.1" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ name = "Helping Hands", light, to = "/", className }: { name?: string; light?: boolean; to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5", light ? "text-blush-100" : "text-berry-700", className)} aria-label={`${name} home`}>
      <LogoMark />
      <span className={cn("font-sans text-[1.35rem] font-bold tracking-[-0.045em]", light ? "text-blush-100" : "text-ink")}>{name}</span>
    </Link>
  );
}
