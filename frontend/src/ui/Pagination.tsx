import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({ page, pages, total, onPage, noun = "results" }: {
  page: number; pages: number; total: number; onPage: (p: number) => void; noun?: string;
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <p className="num text-sm text-ink-3" aria-live="polite">
        {total.toLocaleString("en-IN")} {noun} · page {page} of {Math.max(pages, 1)}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<ChevronLeft className="size-4" />} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
          <Button variant="secondary" size="sm" iconRight={<ChevronRight className="size-4" />} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
        </div>
      )}
    </nav>
  );
}
