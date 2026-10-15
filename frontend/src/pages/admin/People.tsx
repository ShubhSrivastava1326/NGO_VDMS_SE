import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge, UserCheck, UserX, Users } from "lucide-react";
import { adminApi } from "@/api/services";
import type { DuplicateGroup, VolunteerOut, VolunteerStatus } from "@/api/types";
import { DonationsTable } from "@/components/DonationsTable";
import { RegistrationRow } from "@/components/EventViews";
import { useDebounced, usePageTitle } from "@/lib/hooks";
import { cn, fmtDate, fmtDateTime, inrExactStr } from "@/lib/format";
import { Pill, StatusPill, Tag } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { SearchInput } from "@/ui/Fields";
import { PageHeader, SectionHead, Stat } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from "@/ui/States";
import { Tabs } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";

// ------------------------------------------------------------------------------- volunteers
function useVolunteerActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const done = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin"] }); };
  return {
    approve: useMutation({ mutationFn: (v: VolunteerOut) => adminApi.approveVolunteer(v.volunteer_id), onSuccess: (v) => done(`${v.name} is approved.`)(), onError: toast.fail }),
    deactivate: useMutation({ mutationFn: (v: VolunteerOut) => adminApi.deactivateVolunteer(v.volunteer_id), onSuccess: (v) => done(`${v.name} is deactivated.`)(), onError: toast.fail }),
  };
}

export function AdminVolunteers() {
  usePageTitle("Volunteers");
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as VolunteerStatus | null) ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 350);
  const [target, setTarget] = useState<VolunteerOut | null>(null);
  const actions = useVolunteerActions();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (dq !== (params.get("q") ?? "")) set({ q: dq || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const list = useQuery({
    queryKey: ["admin", "volunteers", { status, page, q: params.get("q") ?? "" }],
    queryFn: () => adminApi.volunteers({ status: status || undefined, page, page_size: 15, q: params.get("q") || undefined }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader folio="§ Admin · Volunteers" title="Volunteers" description="Approve new registrations before volunteers can sign up for events." />
      <Tabs label="Volunteer status" value={status || "all"} onChange={(v) => set({ status: v === "all" ? null : v })}
        tabs={[{ id: "pending", label: "Pending" }, { id: "approved", label: "Approved" }, { id: "deactivated", label: "Deactivated" }, { id: "all", label: "All" }]} />
      <div className="my-6 max-w-md"><SearchInput label="Search volunteers" placeholder="Search by name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {list.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState icon={<Users className="size-5" />} title="No volunteers here">{status === "pending" ? "No registrations are waiting for approval." : "Nothing matches this view."}</EmptyState>}
      {list.data && list.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">Volunteer</th><th scope="col">Interests</th><th scope="col">Registered</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.data.items.map((v) => (
                <tr key={v.volunteer_id}>
                  <td data-label="Volunteer">
                    <Link to={`/admin/volunteers/${v.volunteer_id}`} className="font-semibold hover:text-berry-700 hover:underline">{v.name}</Link>
                    <p className="num text-xs text-ink-3">{v.email} · {v.phone_number}</p>
                  </td>
                  <td data-label="Interests"><div className="flex flex-wrap justify-end gap-1 md:justify-start">{v.areas_of_interest.slice(0, 3).map((a) => <Tag key={a}>{a}</Tag>)}</div></td>
                  <td data-label="Registered" className="num whitespace-nowrap text-sm">{fmtDate(v.created_at)}</td>
                  <td data-label="Status"><StatusPill status={v.status} /></td>
                  <td data-label="" className="r whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {v.status !== "approved" && <Button size="sm" icon={<UserCheck className="size-4" />} loading={actions.approve.isPending && actions.approve.variables?.volunteer_id === v.volunteer_id} onClick={() => actions.approve.mutate(v)}>{v.status === "deactivated" ? "Reactivate" : "Approve"}</Button>}
                      {v.status !== "deactivated" && <Button size="sm" variant="secondary" icon={<UserX className="size-4" />} onClick={() => setTarget(v)}>{v.status === "pending" ? "Reject" : "Deactivate"}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun="volunteers" onPage={(p) => set({ page: String(p) })} />
        </>
      )}
      <ConfirmDialog open={!!target} tone="danger" title={target?.status === "pending" ? "Reject this registration?" : "Deactivate this volunteer?"}
        confirmLabel={target?.status === "pending" ? "Reject" : "Deactivate"} onClose={() => setTarget(null)} onConfirm={() => actions.deactivate.mutateAsync(target!)}>
        <strong>{target?.name}</strong> won't be able to sign up for new events. Existing sign-ups are kept, and you can approve them again later.
      </ConfirmDialog>
    </>
  );
}

export function AdminVolunteerDetail() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["admin", "volunteer", Number(id)], queryFn: () => adminApi.volunteer(id) });
  const v = q.data;
  usePageTitle(v?.name ?? "Volunteer");
  const actions = useVolunteerActions();
  const [confirm, setConfirm] = useState(false);

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !v) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;
  const attended = v.assignment_history.filter((r) => r.attendance_status === "attended").length;

  return (
    <>
      <PageHeader back={{ to: "/admin/volunteers", label: "Volunteers" }} folio={`§ Admin · Volunteer #${v.volunteer_id}`} title={v.name}
        description={<StatusPill status={v.status} />}
        actions={
          <>
            {v.status !== "approved" && <Button icon={<UserCheck className="size-4" />} loading={actions.approve.isPending} onClick={() => actions.approve.mutate(v)}>{v.status === "deactivated" ? "Reactivate" : "Approve"}</Button>}
            {v.status !== "deactivated" && <Button variant="secondary" icon={<UserX className="size-4" />} onClick={() => setConfirm(true)}>{v.status === "pending" ? "Reject" : "Deactivate"}</Button>}
          </>
        } />
      <div className="grid gap-12 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          <dl className="space-y-4 text-[0.95rem]">
            <div><dt className="folio">Email</dt><dd className="mt-1 break-all">{v.email}</dd></div>
            <div><dt className="folio">Phone</dt><dd className="num mt-1">{v.phone_number}</dd></div>
            <div><dt className="folio">Interests</dt><dd className="mt-1 flex flex-wrap gap-1.5">{v.areas_of_interest.map((a) => <Tag key={a}>{a}</Tag>)}</dd></div>
            <div><dt className="folio">Availability</dt><dd className="mt-1 text-ink-2">{v.availability || <span className="text-ink-3">Not provided</span>}</dd></div>
            <div><dt className="folio">Registered</dt><dd className="num mt-1">{fmtDateTime(v.created_at)}</dd></div>
          </dl>
          <div className="grid grid-cols-2 gap-6 border-t border-line pt-5">
            <Stat label="Sign-ups" value={v.assignment_history.length} />
            <Stat label="Attended" value={attended} tone="berry" />
          </div>
        </aside>
        <section>
          <SectionHead title="Assignment history" />
          {v.assignment_history.length === 0
            ? <EmptyState title="No sign-ups yet">This volunteer hasn't signed up for any event.</EmptyState>
            : <div className="border-b border-line-strong">{v.assignment_history.map((r) => <RegistrationRow key={r.registration_id} reg={r} />)}</div>}
        </section>
      </div>
      <ConfirmDialog open={confirm} tone="danger" title={v.status === "pending" ? "Reject this registration?" : "Deactivate this volunteer?"} confirmLabel={v.status === "pending" ? "Reject" : "Deactivate"}
        onClose={() => setConfirm(false)} onConfirm={() => actions.deactivate.mutateAsync(v)}>
        {v.name} won't be able to sign up for new events. Existing sign-ups are kept.
      </ConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------------- donors
export function AdminDonors() {
  usePageTitle("Donors");
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1) || 1;
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 350);
  useEffect(() => {
    if (dq !== (params.get("q") ?? "")) {
      const next = new URLSearchParams(params);
      if (dq) next.set("q", dq); else next.delete("q");
      next.delete("page");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const list = useQuery({ queryKey: ["admin", "donors", { page, q: params.get("q") ?? "" }], queryFn: () => adminApi.donors({ page, page_size: 15, q: params.get("q") || undefined }), placeholderData: (p) => p });
  const dups = useQuery({ queryKey: ["admin", "duplicates"], queryFn: adminApi.duplicates });

  return (
    <>
      <PageHeader folio="§ Admin · Donors" title="Donors" description="Find a donor by name, email or phone to see their lifetime giving."
        actions={<Link to="/admin/donors/duplicates" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-berry-700 px-5 text-[0.95rem] font-semibold text-berry-700 hover:bg-blush-100"><GitMerge className="size-4" aria-hidden="true" />Duplicates{dups.data && dups.data.length > 0 ? ` (${dups.data.length})` : ""}</Link>} />
      <div className="mb-6 max-w-md"><SearchInput label="Search donors" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState icon={<Users className="size-5" />} title="No donors found">Donor records are created automatically with the first donation.</EmptyState>}
      {list.data && list.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">Donor</th><th scope="col">Account</th><th scope="col" className="r">Donations</th><th scope="col" className="r">Total given</th></tr></thead>
            <tbody>
              {list.data.items.map((d) => (
                <tr key={d.donor_id}>
                  <td data-label="Donor">
                    <Link to={`/admin/donors/${d.donor_id}`} className="font-semibold hover:text-berry-700 hover:underline">{d.name}</Link>
                    <p className="num text-xs text-ink-3">{d.email}{d.phone_number ? ` · ${d.phone_number}` : ""}</p>
                  </td>
                  <td data-label="Account">{d.is_registered ? <Pill tone="teal">Registered</Pill> : <Pill>Guest</Pill>}</td>
                  <td data-label="Donations" className="num r">{d.donation_count}</td>
                  <td data-label="Total given" className="num r font-medium">{inrExactStr(d.total_donated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun="donors" onPage={(p) => { const n = new URLSearchParams(params); n.set("page", String(p)); setParams(n, { replace: true }); }} />
        </>
      )}
    </>
  );
}

export function AdminDonorDetail() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["admin", "donor", Number(id)], queryFn: () => adminApi.donor(id) });
  const d = q.data;
  usePageTitle(d?.name ?? "Donor");
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !d) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader back={{ to: "/admin/donors", label: "Donors" }} folio={`§ Admin · Donor #${d.donor_id}`} title={d.name}
        description={<span className="flex flex-wrap items-center gap-3">{d.is_registered ? <Pill tone="teal">Registered account</Pill> : <Pill>Guest donor</Pill>}<span className="num text-sm text-ink-2">{d.email}{d.phone_number ? ` · ${d.phone_number}` : ""}</span></span>} />
      <div className="grid gap-8 border-b border-line pb-10 sm:grid-cols-3">
        <Stat label="Lifetime total" value={inrExactStr(d.total_donated)} tone="berry" hint="Completed donations only" />
        <Stat label="Donations" value={d.donation_count} />
        <Stat label="First seen" value={<span className="text-[0.62em]">{fmtDate(d.created_at)}</span>} />
      </div>
      <div className="mt-12 space-y-14">
        <section>
          <SectionHead title="Campaigns supported" />
          {d.by_campaign.length === 0 ? <EmptyState title="No completed donations yet" /> : (
            <table className="ledger">
              <thead><tr><th scope="col">Campaign</th><th scope="col" className="r">Donations</th><th scope="col">Last donation</th><th scope="col" className="r">Total</th></tr></thead>
              <tbody>
                {d.by_campaign.map((c) => (
                  <tr key={c.campaign_id}>
                    <td data-label="Campaign"><Link to={`/admin/campaigns/${c.campaign_id}`} className="font-semibold hover:text-berry-700 hover:underline">{c.campaign_title}</Link></td>
                    <td data-label="Donations" className="num r">{c.donation_count}</td>
                    <td data-label="Last donation" className="num text-sm">{fmtDateTime(c.last_donation_date)}</td>
                    <td data-label="Total" className="num r font-medium">{inrExactStr(c.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section>
          <SectionHead title="All donation attempts" />
          {d.donations.length === 0 ? <EmptyState title="No donations" /> : <DonationsTable rows={d.donations} />}
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------- duplicates
function DuplicateCard({ group }: { group: DuplicateGroup }) {
  const qc = useQueryClient();
  const toast = useToast();
  // pre-select the registered record (it can never be merged away); otherwise the one with most giving
  const [primary, setPrimary] = useState<number>(
    () => (group.donors.find((d) => d.is_registered) ?? [...group.donors].sort((a, b) => b.donation_count - a.donation_count)[0]).donor_id,
  );
  const [confirm, setConfirm] = useState(false);
  const others = group.donors.filter((d) => d.donor_id !== primary);
  const blocked = others.some((d) => d.is_registered);
  const merge = useMutation({
    mutationFn: () => adminApi.mergeDonors(primary, others.map((d) => d.donor_id)),
    onSuccess: () => { toast.success("Donor records merged."); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: toast.fail,
  });

  return (
    <section className="sheet p-5 sm:p-6" aria-label={`Records sharing ${group.email}`}>
      <p className="folio">Shared email</p>
      <h2 className="num mt-1 text-xl font-medium">{group.email}</h2>
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold">Keep which record?</legend>
        <div className="space-y-2">
          {group.donors.map((d) => (
            <label key={d.donor_id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-2.5 transition-colors", primary === d.donor_id ? "border-berry-700 bg-blush-50" : "border-line-strong hover:border-berry-300")}>
              <input type="radio" name={`primary-${group.email}`} className="size-4 accent-[var(--color-berry-700)]" checked={primary === d.donor_id} onChange={() => setPrimary(d.donor_id)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{d.name} {d.is_registered ? <Pill tone="teal">Registered</Pill> : <Pill>Guest</Pill>}</span>
                <span className="num text-xs text-ink-3">#{d.donor_id} · {d.donation_count} donations · {inrExactStr(d.total_donated)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {blocked && <p className="mt-3 text-sm text-danger-600">A registered account can't be merged away. Keep the registered record instead.</p>}
      <Button className="mt-5" icon={<GitMerge className="size-4" />} disabled={blocked} onClick={() => setConfirm(true)}>Merge {others.length} into the selected record</Button>
      <ConfirmDialog open={confirm} title="Merge these donor records?" confirmLabel="Merge records" onClose={() => setConfirm(false)} onConfirm={() => merge.mutateAsync()}>
        Donations from the other {others.length === 1 ? "record move" : "records move"} to <strong>{group.donors.find((d) => d.donor_id === primary)?.name}</strong>, and the duplicate {others.length === 1 ? "record is" : "records are"} deleted. This can't be undone.
      </ConfirmDialog>
    </section>
  );
}

export function AdminDuplicates() {
  usePageTitle("Duplicate donors");
  const q = useQuery({ queryKey: ["admin", "duplicates"], queryFn: adminApi.duplicates });
  return (
    <>
      <PageHeader back={{ to: "/admin/donors", label: "Donors" }} folio="§ Admin · Donors" title={<>Possible <span className="emph">duplicates</span></>}
        description="Records that share an email address. Review them and merge the ones that are the same person." />
      {q.isLoading && <SkeletonRows rows={2} className="h-48" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={<GitMerge className="size-5" />} title="No duplicates to review">Records sharing an email will be flagged here.</EmptyState>}
      <div className="grid max-w-3xl gap-6">{q.data?.map((g) => <DuplicateCard key={g.email} group={g} />)}</div>
    </>
  );
}
