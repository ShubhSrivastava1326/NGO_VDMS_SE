import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HandHeart } from "lucide-react";
import { campaignApi } from "@/api/services";
import { CampaignCard } from "@/components/CampaignViews";
import { useDebounced, usePageTitle } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { Reveal } from "@/motion/Reveal";
import { Button } from "@/ui/Button";
import { FilterSelect, SearchInput } from "@/ui/Fields";
import { PageHeader } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/ui/States";
import { useEffect, useState } from "react";

type Sort = "newest" | "ending_soon" | "most_funded";
const PAGE_SIZE = 9;

export default function Campaigns() {
  usePageTitle("Causes");
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const sort = (params.get("sort") as Sort) || "newest";
  const page = Number(params.get("page") ?? 1) || 1;
  const urlQ = params.get("q") ?? "";

  const [q, setQ] = useState(urlQ);
  const debouncedQ = useDebounced(q, 350);
  useEffect(() => setQ(urlQ), [urlQ]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (debouncedQ !== urlQ) set({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const categories = useQuery({ queryKey: ["campaigns", "categories"], queryFn: campaignApi.categories });
  const list = useQuery({
    queryKey: ["campaigns", { category, sort, page, q: urlQ }],
    queryFn: () => campaignApi.list({ category: category || undefined, sort, page, page_size: PAGE_SIZE, q: urlQ || undefined }),
    placeholderData: (prev) => prev,
  });

  const filtersActive = !!(category || urlQ);

  return (
    <div className="container-page pb-20 pt-10 lg:pt-14">
      <PageHeader
        folio="§ Causes"
        title={<>Campaigns open <span className="emph">for giving</span></>}
        description="Only active campaigns accept donations. Progress shown here is updated the moment a donation completes."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] lg:grid-cols-[minmax(0,1fr)_13rem]">
        <SearchInput label="Search campaigns" placeholder="Search by title or description" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect label="Sort campaigns" value={sort} onChange={(e) => set({ sort: e.target.value === "newest" ? null : e.target.value })}>
          <option value="newest">Newest first</option>
          <option value="ending_soon">Ending soon</option>
          <option value="most_funded">Most funded</option>
        </FilterSelect>
      </div>

      {categories.data && categories.data.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {["", ...categories.data].map((c) => (
            <button
              key={c || "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => set({ category: c || null })}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-semibold capitalize transition-colors",
                category === c ? "border-berry-700 bg-berry-700 text-white" : "border-line-strong bg-white text-ink-2 hover:border-berry-700 hover:text-berry-700",
              )}
            >
              {c || "All causes"}
            </button>
          ))}
        </div>
      )}

      {list.isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading campaigns">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[26rem]" />)}
        </div>
      )}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.isSuccess && list.data.items.length === 0 && (
        <EmptyState
          icon={<HandHeart className="size-5" />}
          title={filtersActive ? "No campaigns match those filters" : "No campaigns are open right now"}
          action={filtersActive ? <Button variant="secondary" onClick={() => { setQ(""); setParams({}, { replace: true }); }}>Clear filters</Button> : undefined}
        >
          {filtersActive ? "Try a different category or search term." : "Check back soon, or volunteer at an upcoming event."}
        </EmptyState>
      )}
      {list.data && list.data.items.length > 0 && (
        <>
          <ul className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", list.isPlaceholderData && "opacity-60 transition-opacity")}>
            {list.data.items.map((c, i) => (
              <Reveal as="li" key={c.campaign_id} delay={(i % 3) * 0.05}><CampaignCard campaign={c} /></Reveal>
            ))}
          </ul>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun={list.data.total === 1 ? "campaign" : "campaigns"} onPage={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0 }); }} />
        </>
      )}
    </div>
  );
}
