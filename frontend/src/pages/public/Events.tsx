import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarX2, MapPin, Settings2 } from "lucide-react";
import { eventApi } from "@/api/services";
import { useAuth } from "@/auth/AuthContext";
import { DateBlock, EventRow, EventSignupButton } from "@/components/EventViews";
import { useDebounced, usePageTitle } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { StatusPill } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { SearchInput } from "@/ui/Fields";
import { PageHeader } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/ui/States";
import { SlotDots } from "@/ui/SlotDots";

export function Events() {
  usePageTitle("Volunteer events");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1) || 1;
  const includePast = params.get("past") === "1";
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const dq = useDebounced(q, 350);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (dq !== urlQ) set({ q: dq || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const list = useQuery({
    queryKey: ["events", { page, includePast, q: urlQ, user: user?.id ?? null }],
    queryFn: () => eventApi.list({ page, page_size: 8, include_past: includePast || undefined, q: urlQ || undefined }),
    placeholderData: (p) => p,
  });

  return (
    <div className="container-page pb-20 pt-10 lg:pt-14">
      <PageHeader
        folio="§ Volunteer"
        title={<>Events that need <span className="emph">your hands</span></>}
        description="Each event has a fixed number of volunteer slots, shown as dots. Approved volunteers can sign up while slots remain."
        actions={!user ? <ButtonLink to="/register/volunteer">Become a volunteer</ButtonLink> : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SearchInput className="min-w-0 flex-1 sm:max-w-md" label="Search events" placeholder="Search by title or location" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] font-medium">
          <input type="checkbox" className="size-[1.15rem] accent-[var(--color-berry-700)]" checked={includePast} onChange={(e) => set({ past: e.target.checked ? "1" : null })} />
          Include past events
        </label>
      </div>

      {list.isLoading && <div className="space-y-3" role="status" aria-label="Loading events">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.isSuccess && list.data.items.length === 0 && (
        <EmptyState icon={<CalendarX2 className="size-5" />} title="No events to show">
          {urlQ ? "No events match your search." : "There are no events open for sign-up right now. Please check back soon."}
        </EmptyState>
      )}
      {list.data && list.data.items.length > 0 && (
        <>
          <div className="border-b border-line-strong">{list.data.items.map((e) => <EventRow key={e.event_id} event={e} level="h2" />)}</div>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun={list.data.total === 1 ? "event" : "events"} onPage={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0 }); }} />
        </>
      )}
    </div>
  );
}

export function EventDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["event", Number(id), user?.id ?? null], queryFn: () => eventApi.get(id) });
  const e = q.data;
  usePageTitle(e?.title ?? "Event");

  if (q.isLoading) return <div className="container-page pb-20 pt-12"><Skeleton className="h-80" /></div>;
  if (q.isError || !e) return <div className="container-page pb-20 pt-14"><ErrorState asPage error={q.error} onRetry={() => q.refetch()} /></div>;

  return (
    <div className="container-page pb-20 pt-10 lg:pt-14">
      <p className="folio"><Link to="/events" className="hover:text-berry-700">← All events</Link></p>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <article>
          <div className="flex items-start gap-6">
            <DateBlock iso={e.event_date} />
            <div className="min-w-0">
              <StatusPill status={e.status} />
              <h1 className="display mt-3 text-[clamp(2.2rem,5vw,4rem)]">{e.title}</h1>
            </div>
          </div>
          <p className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[1.02rem] text-ink-2">
            <span className="inline-flex items-center gap-2"><CalendarClock className="size-[1.1rem] text-berry-700" aria-hidden="true" />{fmtDateTime(e.event_date)}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="size-[1.1rem] text-berry-700" aria-hidden="true" />{e.location}</span>
          </p>
          <p className="mt-8 max-w-2xl whitespace-pre-line text-[1.08rem] leading-relaxed text-ink-2">{e.description}</p>
          {user?.role === "admin" && (
            <ButtonLink to={`/admin/events/${e.event_id}`} variant="soft" size="sm" className="mt-8" icon={<Settings2 className="size-4" />}>Manage this event</ButtonLink>
          )}
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="sheet p-6">
            <p className="folio">Volunteer slots</p>
            <p className="display mt-2 text-[2.4rem] tabular-nums">{e.registered_count}<span className="text-ink-3"> / {e.volunteers_required}</span></p>
            <SlotDots registered={e.registered_count} required={e.volunteers_required} className="mt-3" />
            <p className="num mt-3 text-sm text-ink-3">{e.is_full ? "Fully subscribed" : `${e.slots_remaining} ${e.slots_remaining === 1 ? "slot" : "slots"} still open`}</p>
            <div className="stitch-h my-5" aria-hidden="true" />
            <EventSignupButton event={e} size="lg" />
            {e.my_registration && (
              <p className="mt-4 text-sm text-ink-2">
                <span className="folio mr-2">Your task</span>
                {e.my_registration.task ?? <span className="text-ink-3">Not assigned yet</span>}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
