import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowRight, Receipt } from "lucide-react";
import { ApiError } from "@/api/client";
import { donorApi } from "@/api/services";
import type { DonationStatus } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { CampaignRow } from "@/components/CampaignViews";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { DonationsTable } from "@/components/DonationsTable";
import { usePageTitle } from "@/lib/hooks";
import { fmtDate, inr } from "@/lib/format";
import { ButtonLink, Button } from "@/ui/Button";
import { FilterSelect, TextField } from "@/ui/Fields";
import { PageHeader, SectionHead, Stat } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, FormError, Skeleton, SkeletonRows } from "@/ui/States";
import { useToast } from "@/ui/Toast";

export function DonorDashboard() {
  usePageTitle("Your giving");
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["donor", "dashboard"], queryFn: donorApi.dashboard });

  return (
    <>
      <PageHeader folio="§ Donor" title={<>Hello, <span className="emph">{user?.full_name.split(" ")[0]}</span></>} description="Everything you've given, with a receipt for each completed donation."
        actions={<ButtonLink to="/campaigns" iconRight={<ArrowRight className="size-4" />}>Give to a cause</ButtonLink>} />
      {q.isLoading && <SkeletonRows rows={3} className="h-28" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="space-y-14">
          <div className="grid gap-8 border-b border-line pb-10 sm:grid-cols-3">
            <Stat label="Total donated" value={inr(q.data.donor.total_donated)} tone="berry" hint="Completed donations only" />
            <Stat label="Donations" value={q.data.donor.donation_count} />
            <Stat label="Member since" value={<span className="text-[0.62em]">{fmtDate(q.data.donor.created_at)}</span>} />
          </div>

          <section>
            <SectionHead title="Recent donations" action={<Link to="/donor/donations" className="text-sm font-semibold text-berry-700 hover:underline">View all</Link>} />
            {q.data.recent_donations.length === 0 ? (
              <EmptyState icon={<Receipt className="size-5" />} title="No donations yet" action={<ButtonLink to="/campaigns">Find a cause</ButtonLink>}>
                When you donate while signed in, it shows up here with its receipt.
              </EmptyState>
            ) : <DonationsTable rows={q.data.recent_donations} />}
          </section>

          {q.data.featured_campaigns.length > 0 && (
            <section>
              <SectionHead title="Open campaigns" folio="Ending soonest first" />
              <div className="border-b border-line-strong">
                {q.data.featured_campaigns.map((c, i) => <CampaignRow key={c.campaign_id} campaign={c} index={i} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export function DonorDonations() {
  usePageTitle("Donation history");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DonationStatus | "">("");
  const q = useQuery({
    queryKey: ["donor", "donations", { page, status }],
    queryFn: () => donorApi.donations({ page, page_size: 15, status: status || undefined }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader folio="§ Donor" title={<>Donation <span className="emph">history</span></>} description="Failed or cancelled attempts are listed for transparency, but never count toward a campaign's total." />
      <div className="mb-6 max-w-xs">
        <FilterSelect label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as DonationStatus | ""); setPage(1); }}>
          <option value="">All donations</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </FilterSelect>
      </div>
      {q.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState icon={<Receipt className="size-5" />} title="Nothing here yet" action={<ButtonLink to="/campaigns">Find a cause</ButtonLink>}>No donations match this filter.</EmptyState>}
      {q.data && q.data.items.length > 0 && (
        <>
          <DonationsTable rows={q.data.items} />
          <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} noun="donations" onPage={setPage} />
        </>
      )}
    </>
  );
}

export function DonorProfile() {
  usePageTitle("Your profile");
  const toast = useToast();
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  const q = useQuery({ queryKey: ["donor", "me"], queryFn: donorApi.me });
  // `values` (not per-input defaults) so isDirty is measured against what the server last returned
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm<{ name: string; phone: string }>({
    values: q.data ? { name: q.data.name, phone: q.data.phone_number ?? "" } : undefined,
  });
  const [formError, setFormError] = useState<string>();

  const save = useMutation({
    mutationFn: (v: { name: string; phone: string }) => donorApi.update({ name: v.name.trim(), phone_number: v.phone.trim() || undefined }),
    onSuccess: () => {
      toast.success("Profile saved.");
      qc.invalidateQueries({ queryKey: ["donor"] });
      refreshUser();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [f, m] of Object.entries(e.fieldErrors)) setError(f === "phone_number" ? "phone" : (f as "name"), { message: m });
      } else setFormError(e.message);
    },
  });

  if (q.isLoading) return <Skeleton className="h-80" />;
  if (q.isError || !q.data) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  return (
    <>
      <PageHeader folio="§ Donor" title={<>Your <span className="emph">profile</span></>} />
      <div className="grid gap-14 lg:grid-cols-2">
        <section>
          <SectionHead title="Contact details" />
          <form onSubmit={handleSubmit((v) => { setFormError(undefined); save.mutate(v); })} noValidate className="max-w-md space-y-5">
            <TextField label="Full name" error={errors.name?.message}
              {...register("name", { required: "Enter your name", validate: (v) => v.trim() !== "" || "Enter your name" })} />
            <TextField label="Phone" type="tel" optional error={errors.phone?.message}
              {...register("phone", { validate: (v) => !v.trim() || /^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, "")) || "Enter 7 to 15 digits, with an optional + at the start" })} />
            <TextField label="Email" value={d.email} readOnly disabled hint="Your email is your sign-in ID and can't be changed here." />
            <FormError>{formError}</FormError>
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>Save changes</Button>
          </form>
        </section>
        <section>
          <SectionHead title="Change password" />
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
