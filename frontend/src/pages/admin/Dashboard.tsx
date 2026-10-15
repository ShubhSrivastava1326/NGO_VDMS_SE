import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, FilePlus2, UserCheck } from "lucide-react";
import { adminApi } from "@/api/services";
import { DonationsTable } from "@/components/DonationsTable";
import { usePageTitle } from "@/lib/hooks";
import { inrExactStr } from "@/lib/format";
import { Reveal } from "@/motion/Reveal";
import { ButtonLink } from "@/ui/Button";
import { PageHeader, SectionHead, Stat } from "@/ui/PageHeader";
import { EmptyState, ErrorState, SkeletonRows } from "@/ui/States";

export default function AdminDashboard() {
  usePageTitle("Admin overview");
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: adminApi.dashboard });
  const d = q.data;

  return (
    <>
      <PageHeader
        folio="§ Admin · Overview"
        title={<>The <span className="emph">ledger</span> at a glance</>}
        description="Funds across all campaigns, and what needs attention today."
        actions={
          <>
            <ButtonLink to="/admin/campaigns/new" size="sm" icon={<FilePlus2 className="size-4" />}>New campaign</ButtonLink>
            <ButtonLink to="/admin/events/new" size="sm" variant="secondary" icon={<CalendarPlus className="size-4" />}>New event</ButtonLink>
          </>
        }
      />
      {q.isLoading && <SkeletonRows rows={3} className="h-28" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {d && (
        <div className="space-y-14">
          {d.pending_volunteers > 0 && (
            <Reveal>
              <Link to="/admin/volunteers?status=pending" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-amber-700/30 bg-amber-50 px-5 py-4 transition-colors hover:bg-[#ffeccb]">
                <span className="flex items-center gap-3 font-semibold text-ink">
                  <UserCheck className="size-5 text-amber-700" aria-hidden="true" />
                  {d.pending_volunteers} {d.pending_volunteers === 1 ? "volunteer is" : "volunteers are"} waiting for approval
                </span>
                <span className="text-sm font-semibold text-berry-700">Review now →</span>
              </Link>
            </Reveal>
          )}

          <section aria-label="Funds">
            <div className="grid gap-8 border-y border-line-strong py-8 sm:grid-cols-3 sm:divide-x sm:divide-line">
              <Stat label="Total raised" value={inrExactStr(d.total_raised)} tone="berry" hint="Completed donations only" />
              <Stat label="Utilized" value={inrExactStr(d.total_utilized)} className="sm:pl-8" hint="Recorded against campaigns" />
              <Stat label="Remaining" value={inrExactStr(d.total_remaining)} tone="teal" className="sm:pl-8" hint="Raised minus utilized" />
            </div>
          </section>

          <section aria-label="Counts" className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active campaigns" value={d.campaigns.active} hint={`${d.campaigns.draft} draft · ${d.campaigns.closed} closed`} />
            <Stat label="Donors" value={d.total_donors} hint={<Link className="font-semibold text-berry-700 hover:underline" to="/admin/donors">Search donors</Link>} />
            <Stat label="Approved volunteers" value={d.approved_volunteers} hint={`${d.pending_volunteers} pending`} />
            <Stat label="Upcoming events" value={d.upcoming_events} hint={<Link className="font-semibold text-berry-700 hover:underline" to="/admin/events">Manage events</Link>} />
          </section>

          <section>
            <SectionHead title="Recent donations" action={<Link to="/admin/donations" className="text-sm font-semibold text-berry-700 hover:underline">All donations</Link>} />
            {d.recent_donations.length === 0
              ? <EmptyState title="No completed donations yet">Donations appear here as soon as they complete.</EmptyState>
              : <DonationsTable rows={d.recent_donations} showDonor />}
          </section>
        </div>
      )}
    </>
  );
}
