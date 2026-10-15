import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { metaApi } from "@/api/services";
import type { FaqItem } from "@/api/types";
import { usePageTitle } from "@/lib/hooks";
import { PageHeader } from "@/ui/PageHeader";
import { ErrorState, SkeletonRows } from "@/ui/States";

export default function Help() {
  usePageTitle("Help & FAQ");
  const q = useQuery({ queryKey: ["meta", "faq"], queryFn: metaApi.faq, staleTime: Infinity });

  const groups = new Map<string, FaqItem[]>();
  for (const f of q.data ?? []) groups.set(f.topic, [...(groups.get(f.topic) ?? []), f]);

  return (
    <div className="container-page pb-20 pt-10 lg:pt-14">
      <PageHeader folio="§ Help" title={<>Questions, <span className="emph">answered</span></>} description="How donating, volunteering and event sign-up work." />
      {q.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      <div className="max-w-3xl space-y-12">
        {[...groups.entries()].map(([topic, items]) => (
          <section key={topic} aria-labelledby={`faq-${topic}`}>
            <h2 id={`faq-${topic}`} className="mb-2 text-3xl">{topic}</h2>
            <div className="border-b border-line-strong">
              {items.map((f) => (
                <details key={f.question} className="group border-t border-line-strong">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 text-[1.08rem] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <ChevronDown className="size-5 shrink-0 text-berry-700 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 pr-10 text-ink-2">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
