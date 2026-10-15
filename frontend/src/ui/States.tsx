import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ApiError } from "@/api/client";
import { cn } from "@/lib/format";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

export function PageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[40vh] place-items-center text-berry-700">
      <Spinner className="size-8" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** A list of skeleton lines used while data loads: keeps layout stable. */
export function SkeletonRows({ rows = 4, className = "h-16" }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={cn("w-full", className)} />)}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: {
  icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius-md)] border-2 border-dashed border-blush-300 bg-blush-50/60 px-6 py-12 text-center", className)}>
      {icon && <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-blush-100 text-berry-700">{icon}</div>}
      <h3 className="text-xl">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-ink-2">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** `asPage`: this error replaces the whole page, so its title is the page's h1. */
export function ErrorState({ error, onRetry, className, asPage }: { error: unknown; onRetry?: () => void; className?: string; asPage?: boolean }) {
  const Heading = asPage ? "h1" : "h3";
  const e = error as ApiError | Error | undefined;
  const is404 = e instanceof ApiError && e.status === 404;
  const offline = e instanceof ApiError && e.status === 0;
  return (
    <div role="alert" className={cn("rounded-[var(--radius-md)] border border-danger-600/25 bg-danger-50 px-6 py-8 text-center", className)}>
      <AlertTriangle className="mx-auto mb-2 size-6 text-danger-600" aria-hidden="true" />
      <Heading className="text-xl">{is404 ? "We couldn't find that" : offline ? "Can't reach the server" : "Something went wrong"}</Heading>
      <p className="mx-auto mt-1 max-w-md text-ink-2">{e?.message ?? "Please try again."}</p>
      {onRetry && !is404 && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Inline form-level error (login failed, 409 conflicts, ...). */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger-600/30 bg-danger-50 px-3.5 py-3 text-sm text-danger-600">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
