import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ScrollText } from "lucide-react";
import { ApiError } from "@/api/client";
import { adminApi } from "@/api/services";
import type { DonationStatus } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { DonationsTable } from "@/components/DonationsTable";
import { usePageTitle } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { StatusPill, Tag } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FilterSelect, TextField } from "@/ui/Fields";
import { PageHeader, SectionHead } from "@/ui/PageHeader";
import { PasswordField, passwordRules } from "@/ui/PasswordField";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, FormError, SkeletonRows } from "@/ui/States";
import { useToast } from "@/ui/Toast";

export function AdminDonations() {
  usePageTitle("Donations");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DonationStatus | "">("");
  const [campaignId, setCampaignId] = useState("");
  const campaigns = useQuery({ queryKey: ["admin", "campaigns", "options"], queryFn: () => adminApi.campaigns({ page_size: 100 }) });
  const q = useQuery({
    queryKey: ["admin", "donations", { page, status, campaignId }],
    queryFn: () => adminApi.donations({ page, page_size: 20, status: status || undefined, campaign_id: campaignId ? Number(campaignId) : undefined }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader folio="§ Admin · Donations" title="Donations" description="Every attempt is listed. Only completed donations count toward totals." />
      <div className="mb-6 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
        <FilterSelect label="Filter by campaign" value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setPage(1); }}>
          <option value="">All campaigns</option>
          {campaigns.data?.items.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.title}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as DonationStatus | ""); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </FilterSelect>
      </div>
      {q.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No donations match">Try different filters.</EmptyState>}
      {q.data && q.data.items.length > 0 && (
        <>
          <DonationsTable rows={q.data.items} showDonor />
          <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} noun="donations" onPage={setPage} />
        </>
      )}
    </>
  );
}

const ENTITY_TYPES = ["campaign", "event", "event_registration", "volunteer", "donor", "fund_utilization"];

export function AdminAudit() {
  usePageTitle("Audit log");
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const q = useQuery({ queryKey: ["admin", "audit", { page, entity }], queryFn: () => adminApi.auditLog({ page, page_size: 20, entity_type: entity || undefined }), placeholderData: (p) => p });

  return (
    <>
      <PageHeader folio="§ Admin · Audit" title={<>Audit <span className="emph">log</span></>} description="Who did what, and when. Fund utilization entries always record the admin and the time." />
      <div className="mb-6 max-w-xs">
        <FilterSelect label="Filter by record type" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">All record types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </FilterSelect>
      </div>
      {q.isLoading && <SkeletonRows rows={6} className="h-12" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState icon={<ScrollText className="size-5" />} title="Nothing logged yet" />}
      {q.data && q.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Admin</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {q.data.items.map((l) => (
                <tr key={l.id}>
                  <td data-label="When" className="num whitespace-nowrap text-sm">{fmtDateTime(l.created_at)}</td>
                  <td data-label="Action"><Tag>{l.action}</Tag></td>
                  <td data-label="Record" className="num text-sm">{l.entity_type.replace(/_/g, " ")}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                  <td data-label="Admin" className="num text-sm">{l.user_id ? `#${l.user_id}` : "system"}</td>
                  <td data-label="Details" className="num max-w-xs break-words text-xs text-ink-2">{l.details ? Object.entries(l.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} noun="entries" onPage={setPage} />
        </>
      )}
    </>
  );
}

export function AdminEmails() {
  usePageTitle("E-mail log");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "emails", page], queryFn: () => adminApi.emailLog({ page, page_size: 20 }), placeholderData: (p) => p });
  return (
    <>
      <PageHeader folio="§ Admin · E-mail" title={<>E-mail <span className="emph">log</span></>}
        description={'Every receipt and event notice the system tried to send. "Not sent" means no mail server is configured, so the message was only recorded.'} />
      {q.isLoading && <SkeletonRows rows={6} className="h-12" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No e-mails yet">Receipts and event notices will appear here.</EmptyState>}
      {q.data && q.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">When</th><th scope="col">To</th><th scope="col">Subject</th><th scope="col">Kind</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {q.data.items.map((m) => (
                <tr key={m.id}>
                  <td data-label="When" className="num whitespace-nowrap text-sm">{fmtDateTime(m.created_at)}</td>
                  <td data-label="To" className="num text-sm">{m.to_email}</td>
                  <td data-label="Subject">{m.subject}</td>
                  <td data-label="Kind"><Tag>{m.kind.replace(/_/g, " ")}</Tag></td>
                  <td data-label="Status"><StatusPill status={m.status} />{m.error && <p className="mt-1 max-w-xs text-xs text-danger-600">{m.error}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} noun="e-mails" onPage={setPage} />
        </>
      )}
    </>
  );
}

export function AdminStaff() {
  usePageTitle("Staff accounts");
  const toast = useToast();
  const { user } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<{ name: string; email: string; password: string }>();
  const [formError, setFormError] = useState<string>();
  const create = useMutation({
    mutationFn: (v: { name: string; email: string; password: string }) => adminApi.createAdmin({ name: v.name.trim(), email: v.email.trim(), password: v.password }),
    onSuccess: (u) => { toast.success(`${u.full_name} can now sign in as an admin.`); reset(); },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [f, m] of Object.entries(e.fieldErrors)) if (["name", "email", "password"].includes(f)) setError(f as "name", { message: m });
      } else setFormError(e.message);
    },
  });

  return (
    <>
      <PageHeader folio="§ Admin · Staff" title={<>Staff <span className="emph">accounts</span></>} description={`Signed in as ${user?.full_name} (${user?.email}).`} />
      <div className="grid gap-14 lg:grid-cols-2">
        <section>
          <SectionHead title="Add another admin" />
          <form noValidate onSubmit={handleSubmit((v) => { setFormError(undefined); create.mutate(v); })} className="max-w-md space-y-5">
            <TextField label="Full name" autoComplete="off" error={errors.name?.message} {...register("name", { required: "Enter a name", validate: (v) => v.trim() !== "" || "Enter a name" })} />
            <TextField label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register("email", { required: "Enter an email", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" } })} />
            <PasswordField label="Temporary password" autoComplete="new-password" hint="At least 8 characters, with a letter and a digit." error={errors.password?.message} {...register("password", passwordRules)} />
            <FormError>{formError}</FormError>
            <Button type="submit" loading={create.isPending}>Create admin account</Button>
          </form>
        </section>
        <section>
          <SectionHead title="Change your password" />
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
