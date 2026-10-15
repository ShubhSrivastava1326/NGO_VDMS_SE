import { cn } from "@/lib/format";

/** Volunteer slots as literal dots: filled = taken, open ring = still available. */
export function SlotDots({ registered, required, className }: { registered: number; required: number; className?: string }) {
  const label = `${registered} of ${required} volunteer slots filled`;
  const max = 30;
  if (required > max) {
    const pct = Math.min(100, Math.round((registered / required) * 100));
    return (
      <div className={cn("flex items-center gap-2", className)} role="img" aria-label={label}>
        <div className="stitch-h relative w-28"><span className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-berry-700" style={{ width: `${pct}%` }} /></div>
        <span className="num text-xs text-ink-3">{registered}/{required}</span>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} role="img" aria-label={label}>
      {Array.from({ length: required }, (_, i) => (
        <span key={i} className={cn("size-2.5 rounded-full border-[1.5px]", i < registered ? "border-berry-700 bg-berry-700" : "border-berry-300 bg-transparent")} />
      ))}
    </div>
  );
}
