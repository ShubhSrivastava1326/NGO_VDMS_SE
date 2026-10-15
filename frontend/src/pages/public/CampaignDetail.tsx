import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Flag, Settings2 } from "lucide-react";
import { campaignApi } from "@/api/services";
import { useAuth } from "@/auth/AuthContext";
import { usePageTitle } from "@/lib/hooks";
import { daysLeftLabel, fmtDate, inr } from "@/lib/format";
import { CauseImage } from "@/components/CauseImage";
import { StatusPill, Tag } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ErrorState, Skeleton } from "@/ui/States";
import { ThreadProgress } from "@/ui/ThreadProgress";

const QUICK = ["500", "1000", "2500", "5000"];

export default function CampaignDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["campaign", Number(id)], queryFn: () => campaignApi.get(id), refetchInterval: 30_000 });
  const c = q.data;
  usePageTitle(c?.title ?? "Campaign");

  if (q.isLoading) {
    return (
      <div className="container-page pb-20 pt-10"><Skeleton className="h-56 w-full" /><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]"><Skeleton className="h-96" /><Skeleton className="h-80" /></div></div>
    );
  }
  if (q.isError || !c) {
    return <div className="container-page pb-20 pt-14"><ErrorState asPage error={q.error} onRetry={() => q.refetch()} /></div>;
  }

  const active = c.status === "active";
  const closedWhy = c.closed_reason === "goal_reached" ? "This campaign reached its goal and is no longer accepting donations." : c.closed_reason === "end_date_passed" ? "This campaign has ended." : "This campaign has been closed by the NGO team.";

  return (
    <div className="pb-20">
      <div className="h-44 overflow-hidden border-b border-line sm:h-60">
        <CauseImage category={c.category} className="object-[center_42%]" />
      </div>

      <div className="container-page grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        <article>
          <p className="folio"><Link to="/campaigns" className="hover:text-berry-700">Causes</Link> / {c.category}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Tag>{c.category}</Tag>
            <StatusPill status={c.status} />
          </div>
          <h1 className="display mt-4 text-[clamp(2.4rem,5.5vw,4.4rem)]">{c.title}</h1>
          <p className="mt-6 max-w-2xl whitespace-pre-line text-[1.08rem] leading-relaxed text-ink-2">{c.description}</p>

          <dl className="mt-10 grid max-w-2xl gap-6 border-t border-line-strong pt-6 sm:grid-cols-3">
            <div><dt className="folio flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />Started</dt><dd className="num mt-1">{fmtDate(c.start_date)}</dd></div>
            <div><dt className="folio flex items-center gap-1.5"><Flag className="size-3.5" aria-hidden="true" />Ends</dt><dd className="num mt-1">{fmtDate(c.end_date)}</dd></div>
            <div><dt className="folio">Time left</dt><dd className="num mt-1">{active ? daysLeftLabel(c.end_date) : "Closed"}</dd></div>
          </dl>

          <aside className="mt-10 max-w-2xl rounded-[var(--radius-md)] border border-dashed border-blush-300 bg-blush-50/70 p-5 text-[0.95rem] text-ink-2">
            <p><strong className="font-semibold text-ink">How donations are kept on the record.</strong> Every completed donation gets a numbered receipt. Failed payments never count towards the total.
              The NGO team records how funds are used against this campaign, and the amount used can never exceed the amount raised.</p>
          </aside>

          {user?.role === "admin" && (
            <ButtonLink to={`/admin/campaigns/${c.campaign_id}`} variant="soft" size="sm" className="mt-6" icon={<Settings2 className="size-4" />}>Manage this campaign</ButtonLink>
          )}
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="sheet p-6">
            <p className="folio">Progress</p>
            <p className="display mt-2 text-[2.6rem] tabular-nums text-berry-800">{inr(c.amount_raised)}</p>
            <p className="num text-sm text-ink-3">raised of {inr(c.goal_amount)} goal</p>
            <ThreadProgress percent={c.progress_percent} raised={c.amount_raised} goal={c.goal_amount} size="lg" closed={!active} className="mt-5" />
            <p className="num mt-3 flex justify-between text-sm">
              <span>{c.progress_percent}% funded</span>
              <span className="text-ink-3">{inr(c.amount_remaining)} to go</span>
            </p>

            <div className="stitch-h my-6" aria-hidden="true" />

            {active ? (
              <>
                <ButtonLink to={`/campaigns/${c.campaign_id}/donate`} size="lg" className="w-full">Donate to this cause</ButtonLink>
                <p className="folio mb-2 mt-5">Quick amounts</p>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((a) => (
                    <Link key={a} to={`/campaigns/${c.campaign_id}/donate?amount=${a}`} className="num grid min-h-11 place-items-center rounded-full border border-line-strong text-sm font-medium text-ink-2 transition-colors hover:border-berry-700 hover:text-berry-700">
                      {inr(a)}
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-xs text-ink-3">Demonstration payments: no money is charged.</p>
              </>
            ) : (
              <div role="status" className="rounded-[var(--radius-sm)] bg-blush-50 p-4 text-[0.95rem] text-ink-2">
                {closedWhy}
                <div className="mt-3"><ButtonLink to="/campaigns" variant="secondary" size="sm">See open campaigns</ButtonLink></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
