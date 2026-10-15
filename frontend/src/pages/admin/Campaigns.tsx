import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ExternalLink, FilePlus2, FileText, Lock, Table2 } from "lucide-react";
import { ApiError } from "@/api/client";
import { adminApi, type CampaignBody } from "@/api/services";
import type { CampaignOut, CampaignStatus } from "@/api/types";
import { DonationsTable } from "@/components/DonationsTable";
import { FundSpool } from "@/components/FundSpool";
import { useDebounced, useMeta, usePageTitle } from "@/lib/hooks";
import { fmtDate, inr, inrExactStr, todayIso } from "@/lib/format";
import { StatusPill, Tag } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { MoneyField, SearchInput, TextAreaField, TextField } from "@/ui/Fields";
import { PageHeader, SectionHead } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, FormError, Skeleton, SkeletonRows } from "@/ui/States";
import { Tabs } from "@/ui/Tabs";
import { ThreadProgress } from "@/ui/ThreadProgress";
import { useToast } from "@/ui/Toast";

const MONEY = /^\d+(\.\d{1,2})?$/;

// ------------------------------------------------------------------------------------- list
export function AdminCampaigns() {
  usePageTitle("Campaigns");
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as CampaignStatus | null) ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 350);

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
    queryKey: ["admin", "campaigns", { status, page, q: params.get("q") ?? "" }],
    queryFn: () => adminApi.campaigns({ status: status || undefined, page, page_size: 15, q: params.get("q") || undefined }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader folio="§ Admin · Campaigns" title={<>Campaigns</>} description="Create, publish, monitor and close fundraising campaigns."
        actions={<ButtonLink to="/admin/campaigns/new" icon={<FilePlus2 className="size-4" />}>New campaign</ButtonLink>} />
      <Tabs label="Campaign status" value={status || "all"} onChange={(v) => set({ status: v === "all" ? null : v })}
        tabs={[{ id: "all", label: "All" }, { id: "draft", label: "Draft" }, { id: "active", label: "Active" }, { id: "closed", label: "Closed" }]} />
      <div className="my-6 max-w-md"><SearchInput label="Search campaigns" placeholder="Search by title or category" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {list.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState icon={<FilePlus2 className="size-5" />} title="No campaigns found" action={<ButtonLink to="/admin/campaigns/new">Create a campaign</ButtonLink>}>Nothing matches this view.</EmptyState>}
      {list.data && list.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col" className="w-64">Progress</th><th scope="col">Ends</th></tr></thead>
            <tbody>
              {list.data.items.map((c) => (
                <tr key={c.campaign_id}>
                  <td data-label="Campaign">
                    <Link to={`/admin/campaigns/${c.campaign_id}`} className="font-semibold hover:text-berry-700 hover:underline">{c.title}</Link>
                    <div className="mt-0.5"><Tag>{c.category}</Tag></div>
                  </td>
                  <td data-label="Status"><StatusPill status={c.status} /></td>
                  <td data-label="Progress">
                    <div className="w-full md:w-56">
                      <ThreadProgress percent={c.progress_percent} raised={c.amount_raised} goal={c.goal_amount} size="sm" closed={c.status === "closed"} />
                      <p className="num mt-1 text-xs text-ink-3">{inr(c.amount_raised)} of {inr(c.goal_amount)}</p>
                    </div>
                  </td>
                  <td data-label="Ends" className="num whitespace-nowrap">{fmtDate(c.end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun="campaigns" onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------- form
interface CampaignFormValues { title: string; category: string; description: string; goal_amount: string; start_date: string; end_date: string }
const FORM_FIELDS = ["title", "category", "description", "goal_amount", "start_date", "end_date"] as const;

function CampaignForm({ campaign, onSaved }: { campaign?: CampaignOut; onSaved: (c: CampaignOut) => void }) {
  const meta = useMeta();
  const toast = useToast();
  const active = campaign?.status === "active";
  const closed = campaign?.status === "closed";
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, getValues, formState: { errors, isSubmitting, dirtyFields } } = useForm<CampaignFormValues>({
    values: campaign
      ? { title: campaign.title, category: campaign.category, description: campaign.description, goal_amount: campaign.goal_amount, start_date: campaign.start_date, end_date: campaign.end_date }
      : { title: "", category: "", description: "", goal_amount: "", start_date: todayIso(), end_date: "" },
  });
  const locked = (name: (typeof FORM_FIELDS)[number]) => closed || (active && name !== "description" && name !== "end_date");

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      let saved: CampaignOut;
      if (!campaign) {
        saved = await adminApi.createCampaign({ ...v, title: v.title.trim(), category: v.category.trim(), description: v.description.trim() } satisfies CampaignBody);
        toast.success("Campaign created as a draft.");
      } else {
        // PATCH only what changed; locked fields are never sent for an active campaign
        const patch: Partial<CampaignBody> = {};
        for (const f of FORM_FIELDS) if (dirtyFields[f] && !locked(f)) patch[f] = v[f].trim();
        if (Object.keys(patch).length === 0) { toast.info("Nothing to save."); return; }
        saved = await adminApi.updateCampaign(campaign.campaign_id, patch);
        toast.success("Campaign updated.");
      }
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError) {
        let mapped = false;
        for (const [f, m] of Object.entries(e.fieldErrors)) {
          if ((FORM_FIELDS as readonly string[]).includes(f)) { setError(f as keyof CampaignFormValues, { message: m }); mapped = true; }
        }
        if (!mapped || e.code === "CAMPAIGN_FIELD_LOCKED") setFormError(e.message);
      } else setFormError("Something went wrong.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5">
      {active && (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-berry-700" aria-hidden="true" />
          This campaign is active, so only the description and end date can be changed.
        </p>
      )}
      {closed && <p className="rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">A closed campaign can't be edited.</p>}
      <TextField label="Title" disabled={locked("title")} error={errors.title?.message} maxLength={100}
        {...register("title", { required: "Enter a title", validate: (v) => v.trim() !== "" || "Enter a title", maxLength: { value: 100, message: "Keep it under 100 characters" } })} />
      <div>
        <TextField label="Category" list="campaign-categories" disabled={locked("category")} hint="Pick a suggestion or type your own." error={errors.category?.message} maxLength={60}
          {...register("category", { required: "Enter a category", validate: (v) => v.trim() !== "" || "Enter a category" })} />
        <datalist id="campaign-categories">{meta.data?.suggested_campaign_categories.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <TextAreaField label="Description" rows={6} disabled={closed} error={errors.description?.message}
        {...register("description", { required: "Describe the campaign", validate: (v) => v.trim() !== "" || "Describe the campaign" })} />
      <MoneyField label="Goal amount (INR)" disabled={locked("goal_amount")} error={errors.goal_amount?.message}
        {...register("goal_amount", { required: "Enter a goal", validate: (v) => (MONEY.test(v.trim()) && Number(v) > 0) || "Enter an amount above zero with at most 2 decimals" })} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Start date" type="date" disabled={locked("start_date")} error={errors.start_date?.message}
          {...register("start_date", { required: "Choose a start date" })} />
        <TextField label="End date" type="date" disabled={locked("end_date")} error={errors.end_date?.message}
          {...register("end_date", { required: "Choose an end date", validate: (v) => !getValues("start_date") || v > getValues("start_date") || "The end date must be after the start date" })} />
      </div>
      <FormError>{formError}</FormError>
      {!closed && <Button type="submit" size="lg" loading={isSubmitting}>{campaign ? "Save changes" : "Create draft campaign"}</Button>}
    </form>
  );
}

export function AdminCampaignNew() {
  usePageTitle("New campaign");
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader back={{ to: "/admin/campaigns", label: "Campaigns" }} folio="§ Admin · Campaigns" title={<>New <span className="emph">campaign</span></>}
        description="Campaigns start as drafts. Publish one when it's ready to accept donations." />
      <CampaignForm onSaved={(c) => { qc.invalidateQueries({ queryKey: ["admin"] }); navigate(`/admin/campaigns/${c.campaign_id}`); }} />
    </>
  );
}

// ------------------------------------------------------------------------------------ detail
export function AdminCampaignDetail() {
  const { id = "" } = useParams();
  const cid = Number(id);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"publish" | "close" | null>(null);

  const q = useQuery({ queryKey: ["admin", "campaign", cid], queryFn: () => adminApi.campaign(cid) });
  const c = q.data;
  usePageTitle(c?.title ?? "Campaign");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["campaigns"] }); qc.invalidateQueries({ queryKey: ["campaign", cid] }); };

  const publish = useMutation({ mutationFn: () => adminApi.publishCampaign(cid), onSuccess: () => { toast.success("Campaign published. It now accepts donations."); refresh(); }, onError: toast.fail });
  const close = useMutation({ mutationFn: () => adminApi.closeCampaign(cid), onSuccess: () => { toast.success("Campaign closed."); refresh(); }, onError: toast.fail });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !c) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;

  const closedWhy = c.closed_reason === "goal_reached" ? "Goal reached" : c.closed_reason === "end_date_passed" ? "End date passed" : c.closed_reason === "manual" ? "Closed manually" : "";

  return (
    <>
      <PageHeader
        back={{ to: "/admin/campaigns", label: "Campaigns" }}
        folio={`§ Admin · Campaign #${c.campaign_id}`}
        title={c.title}
        description={<span className="flex flex-wrap items-center gap-2"><StatusPill status={c.status} />{closedWhy && <span className="text-sm text-ink-3">{closedWhy}</span>}<Tag>{c.category}</Tag></span>}
        actions={
          <>
            {c.status === "draft" && <Button onClick={() => setConfirm("publish")}>Publish campaign</Button>}
            {c.status === "active" && <Button variant="secondary" onClick={() => setConfirm("close")}>Close early</Button>}
            {c.status !== "draft" && <ButtonLink to={`/campaigns/${c.campaign_id}`} variant="ghost" icon={<ExternalLink className="size-4" />}>Public page</ButtonLink>}
          </>
        }
      />
      <Tabs label="Campaign sections" panelId="campaign-panel" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[{ id: "overview", label: "Overview" }, { id: "donations", label: "Donations" }, { id: "funds", label: "Fund utilization" }]} />
      <div className="pt-8" role="tabpanel" id="campaign-panel" aria-label={tab === "funds" ? "Fund utilization" : tab === "donations" ? "Donations" : "Overview"}>
        {tab === "overview" && (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <CampaignForm campaign={c} onSaved={refresh} />
            <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
              <div className="sheet p-5">
                <p className="folio">Raised</p>
                <p className="display mt-1 text-4xl tabular-nums text-berry-800">{inr(c.amount_raised)}</p>
                <p className="num text-sm text-ink-3">of {inr(c.goal_amount)} · {c.progress_percent}%</p>
                <ThreadProgress percent={c.progress_percent} raised={c.amount_raised} goal={c.goal_amount} className="mt-4" closed={c.status === "closed"} />
                <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-3">Starts</dt><dd className="num">{fmtDate(c.start_date)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-3">Ends</dt><dd className="num">{fmtDate(c.end_date)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-3">Still needed</dt><dd className="num">{inr(c.amount_remaining)}</dd></div>
                </dl>
              </div>
            </aside>
          </div>
        )}
        {tab === "donations" && <CampaignDonations campaignId={cid} />}
        {tab === "funds" && (c.status === "draft"
          ? <EmptyState icon={<Table2 className="size-5" />} title="Publish first">Funds can only be recorded against an active or closed campaign.</EmptyState>
          : <FundsPanel campaign={c} />)}
      </div>

      <ConfirmDialog open={confirm === "publish"} title="Publish this campaign?" confirmLabel="Publish" onClose={() => setConfirm(null)} onConfirm={() => publish.mutateAsync()}>
        It becomes visible to everyone and starts accepting donations straight away. The goal amount can't be changed after this.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "close"} title="Close this campaign early?" tone="danger" confirmLabel="Close campaign" onClose={() => setConfirm(null)} onConfirm={() => close.mutateAsync()}>
        It stops accepting donations immediately and can't be reopened. Donations already received are kept.
      </ConfirmDialog>
    </>
  );
}

function CampaignDonations({ campaignId }: { campaignId: number }) {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "donations", { campaignId, page }], queryFn: () => adminApi.donations({ campaign_id: campaignId, page, page_size: 15 }), placeholderData: (p) => p });
  if (q.isLoading) return <SkeletonRows rows={4} className="h-14" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.items.length === 0) return <EmptyState title="No donations yet">Donations to this campaign will be listed here.</EmptyState>;
  return (
    <>
      <DonationsTable rows={q.data.items} showDonor showCampaign={false} />
      <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} noun="donations" onPage={setPage} />
    </>
  );
}

// ------------------------------------------------------------------------------ fund utilization
interface UtilForm { category: string; amount: string; description: string; reference_number: string; utilization_date: string }

function FundsPanel({ campaign }: { campaign: CampaignOut }) {
  const id = campaign.campaign_id;
  const meta = useMeta();
  const toast = useToast();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string>();
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const report = useQuery({ queryKey: ["admin", "fund-report", id], queryFn: () => adminApi.fundReport(id) });
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<UtilForm>({
    defaultValues: { category: "", amount: "", description: "", reference_number: "", utilization_date: todayIso() },
  });
  const remaining = report.data?.remaining_balance;

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      await adminApi.recordUtilization(id, { category: v.category.trim(), amount: v.amount.trim(), description: v.description.trim(), reference_number: v.reference_number.trim(), utilization_date: v.utilization_date || undefined });
      toast.success("Expense recorded.");
      reset({ category: "", amount: "", description: "", reference_number: "", utilization_date: todayIso() });
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [f, m] of Object.entries(e.fieldErrors)) if (f in v) setError(f as keyof UtilForm, { message: m });
      } else setFormError(e instanceof Error ? e.message : "Something went wrong.");
      if (e instanceof ApiError && e.code === "UTILIZATION_EXCEEDS_RAISED") qc.invalidateQueries({ queryKey: ["admin", "fund-report", id] });
    }
  });

  const doExport = async (format: "pdf" | "csv") => {
    setExporting(format);
    try { await adminApi.exportFundReport(id, format); } catch (e) { toast.fail(e); } finally { setExporting(null); }
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section>
        <SectionHead title="Fund report" action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<FileText className="size-4" />} loading={exporting === "pdf"} onClick={() => doExport("pdf")}>PDF</Button>
            <Button size="sm" variant="secondary" icon={<Table2 className="size-4" />} loading={exporting === "csv"} onClick={() => doExport("csv")}>CSV</Button>
          </div>
        } />
        {report.isLoading && <Skeleton className="h-64" />}
        {report.isError && <ErrorState error={report.error} onRetry={() => report.refetch()} />}
        {report.data && <FundSpool report={report.data} />}
      </section>

      <section>
        <SectionHead title="Record an expense" />
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <TextField label="Category" list="util-categories" error={errors.category?.message} maxLength={60}
              {...register("category", { required: "Enter a category", validate: (v) => v.trim() !== "" || "Enter a category" })} />
            <datalist id="util-categories">{meta.data?.suggested_utilization_categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <MoneyField label="Amount (INR)" error={errors.amount?.message}
            hint={remaining !== undefined ? `Available to record: ${inrExactStr(remaining)}` : undefined}
            {...register("amount", {
              required: "Enter an amount",
              validate: (v) => {
                if (!MONEY.test(v.trim()) || Number(v) <= 0) return "Enter an amount above zero with at most 2 decimals";
                if (remaining !== undefined && Number(v) > Number(remaining)) return `That's more than the ${inrExactStr(remaining)} still available`;
                return true;
              },
            })} />
          <TextAreaField label="Description" rows={2} error={errors.description?.message} {...register("description", { required: "Describe what was bought or paid for", validate: (v) => v.trim() !== "" || "Describe what was bought or paid for" })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Invoice / voucher no." error={errors.reference_number?.message} maxLength={60} {...register("reference_number", { required: "Enter the reference number", validate: (v) => v.trim() !== "" || "Enter the reference number" })} />
            <TextField label="Date spent" type="date" max={todayIso()} error={errors.utilization_date?.message} {...register("utilization_date")} />
          </div>
          <FormError>{formError}</FormError>
          <Button type="submit" loading={isSubmitting} disabled={remaining !== undefined && Number(remaining) <= 0}>Record expense</Button>
          {remaining !== undefined && Number(remaining) <= 0 && <p className="text-sm text-ink-3">Nothing is left to record: spending can't exceed the amount raised.</p>}
        </form>
      </section>

      <section className="lg:col-span-2">
        <SectionHead title="Recorded expenses" folio="Newest first" />
        {report.data && report.data.entries.length === 0 && <EmptyState title="No expenses recorded yet">Expenses you record appear here with their voucher reference.</EmptyState>}
        {report.data && report.data.entries.length > 0 && (
          <table className="ledger">
            <thead><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Description</th><th scope="col">Reference</th><th scope="col">Recorded by</th><th scope="col" className="r">Amount</th></tr></thead>
            <tbody>
              {report.data.entries.map((e) => (
                <tr key={e.utilization_id}>
                  <td data-label="Date" className="num whitespace-nowrap">{fmtDate(e.utilization_date)}</td>
                  <td data-label="Category"><Tag>{e.category}</Tag></td>
                  <td data-label="Description" className="max-w-xs">{e.description}</td>
                  <td data-label="Reference" className="num text-sm">{e.reference_number}</td>
                  <td data-label="Recorded by" className="text-sm text-ink-2">{e.recorded_by_name}</td>
                  <td data-label="Amount" className="num r font-medium">{inrExactStr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
