import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Banknote, CreditCard, Download, FileText, Landmark, Smartphone } from "lucide-react";
import { ApiError } from "@/api/client";
import { campaignApi, donationApi } from "@/api/services";
import type { DonationCreateBody, DonationInitiated, DonationOut, PaymentMethod, ReceiptOut } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { donationTokens, useMeta, usePageTitle } from "@/lib/hooks";
import { cn, inr, inrExactStr, paymentLabel } from "@/lib/format";
import { CauseImage } from "@/components/CauseImage";
import { ReceiptSlip, SnapThread, TiedThread } from "@/motion/ThreadMoments";
import { Button, ButtonLink } from "@/ui/Button";
import { MoneyField, TextField } from "@/ui/Fields";
import { ErrorState, FormError, Skeleton } from "@/ui/States";
import { Stepper } from "@/ui/Stepper";
import { ThreadProgress } from "@/ui/ThreadProgress";
import { useToast } from "@/ui/Toast";

type Phase = "details" | "confirm" | "done" | "failed" | "closed";
interface DetailsForm { amount: string; method: PaymentMethod; name: string; email: string; phone: string; pan: string }

const QUICK = ["500", "1000", "2500", "5000"];
const METHODS: { id: PaymentMethod; icon: typeof CreditCard; hint: string }[] = [
  { id: "upi", icon: Smartphone, hint: "Pay with any UPI app" },
  { id: "card", icon: CreditCard, hint: "Debit or credit card" },
  { id: "net_banking", icon: Landmark, hint: "Your bank's website" },
];
const flowKey = (campaignId: number) => `vdms_donation_flow_${campaignId}`;

// server field names -> form field names (guide section 5.1)
const FIELD_MAP: Record<string, keyof DetailsForm> = {
  amount: "amount", payment_method: "method", pan_tax_id: "pan",
  "donor.name": "name", "donor.email": "email", "donor.phone_number": "phone",
};

export default function Donate() {
  const { id = "" } = useParams();
  const campaignId = Number(id);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDonor = user?.role === "donor";
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useMeta();

  const campaignQ = useQuery({ queryKey: ["campaign", campaignId], queryFn: () => campaignApi.get(campaignId) });
  const campaign = campaignQ.data;
  usePageTitle(campaign ? `Donate to ${campaign.title}` : "Donate");

  const [phase, setPhase] = useState<Phase>("details");
  const [init, setInit] = useState<DonationInitiated | null>(null);
  const [result, setResult] = useState<DonationOut | null>(null);
  const [receipt, setReceipt] = useState<ReceiptOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [simulate, setSimulate] = useState<"auto" | "success" | "failure">("auto");

  const form = useForm<DetailsForm>({
    defaultValues: {
      amount: /^\d+(\.\d{1,2})?$/.test(search.get("amount") ?? "") ? search.get("amount")! : "",
      method: "upi",
      name: !isDonor && user ? user.full_name : "",
      email: !isDonor && user ? user.email : "",
      phone: "",
      pan: "",
    },
  });
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = form;
  const amountValue = watch("amount");
  const method = watch("method");

  const persist = (d: DonationInitiated) => {
    donationTokens.set(d.donation.donation_id, d.access_token);
    try { sessionStorage.setItem(flowKey(campaignId), JSON.stringify(d)); } catch { /* ignore */ }
  };
  const forget = () => { try { sessionStorage.removeItem(flowKey(campaignId)); } catch { /* ignore */ } };
  const refreshCaches = () => {
    for (const key of ["campaigns", "campaign", "donor", "admin"]) qc.invalidateQueries({ queryKey: [key] });
  };

  // Restore an unfinished confirm step after a page refresh (the token survives in sessionStorage).
  useEffect(() => {
    let alive = true;
    try {
      const saved = sessionStorage.getItem(flowKey(campaignId));
      if (!saved) return;
      const d = JSON.parse(saved) as DonationInitiated;
      donationApi.get(d.donation.donation_id, d.access_token).then((cur) => {
        if (!alive) return;
        if (cur.status === "pending") { setInit(d); setPhase("confirm"); } else forget();
      }).catch(() => forget());
    } catch { /* ignore corrupt state */ }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleApiError = (e: unknown) => {
    if (!(e instanceof ApiError)) { setFormError("Something went wrong. Please try again."); return; }
    if (e.code === "CAMPAIGN_NOT_ACTIVE") { forget(); setPhase("closed"); refreshCaches(); return; }
    let mapped = false;
    for (const [field, message] of Object.entries(e.fieldErrors)) {
      const target = FIELD_MAP[field];
      if (target) { setError(target, { message }); mapped = true; }
    }
    if (!mapped) setFormError(e.message);
  };

  const start = handleSubmit(async (v) => {
    setFormError(undefined);
    const body: DonationCreateBody = {
      campaign_id: campaignId,
      amount: v.amount.trim(),
      payment_method: v.method,
      pan_tax_id: v.pan.trim() || undefined,
      ...(isDonor ? {} : { donor: { name: v.name.trim(), email: v.email.trim(), phone_number: v.phone.trim() || undefined } }),
    };
    try {
      const res = await donationApi.create(body);
      persist(res);
      setInit(res);
      setPhase("confirm");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      handleApiError(e);
    }
  });

  const pay = async () => {
    if (!init || busy) return;
    setBusy(true);
    setFormError(undefined);
    try {
      const forced = meta.data?.payment_simulation_allows_forced_outcome && simulate !== "auto" ? simulate : undefined;
      const d = await donationApi.confirm(init.donation.donation_id, init.access_token, forced);
      setResult(d);
      if (d.status === "completed") {
        forget();
        setPhase("done");
        refreshCaches();
        donationApi.receipt(d.donation_id, init.access_token).then(setReceipt).catch((e) => toast.fail(e));
      } else {
        setPhase("failed"); // HTTP 200 with status "failed": totals are untouched
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "DONATION_NOT_PENDING") {
        // double submit or another tab finished it: show the truth
        const cur = await donationApi.get(init.donation.donation_id, init.access_token).catch(() => null);
        if (cur?.status === "completed") { setResult(cur); setPhase("done"); donationApi.receipt(cur.donation_id, init.access_token).then(setReceipt).catch(() => {}); refreshCaches(); }
        else if (cur?.status === "failed") { setResult(cur); setPhase("failed"); }
        else toast.fail(e);
      } else if (e instanceof ApiError && e.code === "CAMPAIGN_NOT_ACTIVE") {
        forget(); setPhase("closed"); refreshCaches();
      } else toast.fail(e);
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!init || busy) return;
    setBusy(true);
    try {
      const next = await donationApi.retry(init.donation.donation_id, init.access_token);
      persist(next);
      setInit(next);
      setResult(null);
      setPhase("confirm");
    } catch (e) {
      if (e instanceof ApiError && e.code === "CAMPAIGN_NOT_ACTIVE") { forget(); setPhase("closed"); } else toast.fail(e);
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!init || busy) return;
    setBusy(true);
    try {
      await donationApi.cancel(init.donation.donation_id, init.access_token);
      forget();
      toast.info("Donation cancelled. Nothing was charged.");
      navigate(`/campaigns/${campaignId}`);
    } catch (e) { toast.fail(e); } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    if (!result || !init) return;
    setPdfBusy(true);
    try { await donationApi.downloadReceiptPdf(result.donation_id, init.access_token, `${result.receipt_number ?? "receipt"}.pdf`); }
    catch (e) { toast.fail(e); } finally { setPdfBusy(false); }
  };

  if (campaignQ.isLoading) return <div className="container-page pb-20 pt-12"><Skeleton className="h-[28rem]" /></div>;
  if (campaignQ.isError || !campaign) return <div className="container-page pb-20 pt-14"><ErrorState asPage error={campaignQ.error} onRetry={() => campaignQ.refetch()} /></div>;

  // A campaign that is not active cannot take donations (unless we're already showing a result).
  const blocked = phase === "closed" || (campaign.status !== "active" && phase === "details");
  const stepIndex = phase === "details" ? 0 : phase === "confirm" || phase === "failed" ? 1 : phase === "done" ? 3 : 0;
  const maxAmount = meta.data?.max_single_donation;

  return (
    <div className="container-page pb-20 pt-8 lg:pt-12">
      <p className="folio"><Link to={`/campaigns/${campaign.campaign_id}`} className="hover:text-berry-700">← {campaign.title}</Link></p>
      <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">
        {phase === "done" ? <>Thank <span className="emph">you.</span></> : phase === "failed" ? <>That didn't <span className="emph">go through.</span></> : <>Make a <span className="emph">donation</span></>}
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-16">
        <div>
          {!blocked && <Stepper steps={["Details", "Confirm", "Receipt"]} current={stepIndex} failed={phase === "failed"} className="mb-10 max-w-md" />}

          {blocked && (
            <div role="status" className="sheet p-8 text-center">
              <h2 className="text-3xl">This campaign isn't accepting donations</h2>
              <p className="mx-auto mt-3 max-w-md text-ink-2">
                {phase === "closed" ? "It closed just now, so your donation was not taken. " : ""}Only active campaigns can receive donations. Nothing was charged.
              </p>
              <ButtonLink to="/campaigns" className="mt-6">See open campaigns</ButtonLink>
            </div>
          )}

          {/* ---------------------------------------------------------- step 1: details */}
          {!blocked && phase === "details" && (
            <form onSubmit={start} noValidate className="max-w-xl space-y-8">
              <section aria-labelledby="amt-h">
                <h2 id="amt-h" className="text-xl">How much would you like to give?</h2>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
                  {QUICK.map((a) => (
                    <button key={a} type="button" aria-pressed={amountValue === a} onClick={() => setValue("amount", a, { shouldValidate: true })}
                      className={cn("num min-h-11 rounded-full border px-5 text-sm font-medium transition-colors", amountValue === a ? "border-berry-700 bg-berry-700 text-white" : "border-line-strong bg-white text-ink-2 hover:border-berry-700")}>
                      {inr(a)}
                    </button>
                  ))}
                </div>
                <MoneyField
                  className="mt-4"
                  label="Amount (INR)"
                  hint={maxAmount ? `Up to ${inr(maxAmount)} per donation` : undefined}
                  error={errors.amount?.message}
                  {...register("amount", {
                    required: "Enter an amount",
                    validate: (v) => {
                      if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return "Use a number with at most 2 decimals, e.g. 500 or 499.50";
                      if (Number(v) <= 0) return "The amount must be more than zero";
                      if (maxAmount && Number(v) > Number(maxAmount)) return `The maximum single donation is ${inr(maxAmount)}`;
                      return true;
                    },
                  })}
                />
              </section>

              <fieldset>
                <legend className="text-xl">Payment method</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {METHODS.filter((m) => !meta.data || meta.data.payment_methods.includes(m.id)).map((m) => (
                    <label key={m.id} className={cn(
                      "relative flex min-h-[4.5rem] cursor-pointer flex-col justify-center gap-1 rounded-[var(--radius-md)] border bg-white px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-berry-700",
                      method === m.id ? "border-berry-700 bg-blush-50 shadow-[inset_0_0_0_1px_var(--color-berry-700)]" : "border-line-strong hover:border-berry-300",
                    )}>
                      <input type="radio" value={m.id} className="sr-only" {...register("method", { required: true })} />
                      <span className="flex items-center gap-2 font-semibold"><m.icon className="size-[1.1rem] text-berry-700" aria-hidden="true" />{paymentLabel(m.id)}</span>
                      <span className="text-xs text-ink-3">{m.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <section aria-labelledby="who-h" className="space-y-4">
                <h2 id="who-h" className="text-xl">{isDonor ? "Donating as" : "Your details"}</h2>
                {isDonor ? (
                  <p className="rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-ink-2">
                    <strong className="text-ink">{user?.full_name}</strong> · {user?.email}
                  </p>
                ) : (
                  <>
                    <TextField label="Full name" autoComplete="name" error={errors.name?.message}
                      {...register("name", { required: "Enter your name", maxLength: { value: 100, message: "Keep it under 100 characters" }, validate: (v) => v.trim() !== "" || "Enter your name" })} />
                    <TextField label="Email" type="email" autoComplete="email" hint="Your receipt is tied to this address." error={errors.email?.message}
                      {...register("email", { required: "Enter your email", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" } })} />
                    <TextField label="Phone" type="tel" autoComplete="tel" optional error={errors.phone?.message}
                      {...register("phone", { validate: (v) => !v.trim() || /^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, "")) || "Enter 7 to 15 digits, with an optional + at the start" })} />
                  </>
                )}
                <TextField label="PAN / tax ID" optional hint="Printed on your receipt if you provide it." autoComplete="off" error={errors.pan?.message}
                  {...register("pan", { validate: (v) => !v.trim() || /^[A-Za-z0-9]{5,20}$/.test(v.trim()) || "Use 5 to 20 letters or digits" })} />
              </section>

              <FormError>{formError}</FormError>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" size="lg" loading={isSubmitting} className="min-w-[14rem]">Continue to confirm</Button>
                <p className="text-sm text-ink-3">Demonstration payments: no money is charged.</p>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------------- step 2: confirm */}
          {phase === "confirm" && init && (
            <div className="max-w-xl">
              <h2 className="text-2xl">Review and confirm</h2>
              <dl className="mt-5 border-y border-line-strong">
                {([
                  ["Campaign", init.confirmation.campaign_title],
                  ["Donor", init.confirmation.donor_name],
                  ["Payment method", paymentLabel(init.confirmation.payment_method)],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 border-b border-dashed border-blush-300 py-3 last:border-0">
                    <dt className="folio pt-0.5">{k}</dt><dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-6 border-t border-line-strong py-4">
                  <dt className="folio">Amount</dt>
                  <dd className="display text-[2.6rem] tabular-nums text-berry-800">{inrExactStr(init.confirmation.amount)}</dd>
                </div>
              </dl>

              <p className="mt-4 rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">
                This is a demonstration payment. Confirming records the donation in this system, and no money is charged.
              </p>

              {meta.data?.payment_simulation_allows_forced_outcome && (
                <details className="mt-4 rounded-[var(--radius-sm)] border border-line-strong bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2">Demo controls</summary>
                  <fieldset className="mt-3 space-y-2">
                    <legend className="text-sm text-ink-3">Choose how the simulated payment should end.</legend>
                    {([["auto", "Let the system decide"], ["success", "Approve the payment"], ["failure", "Decline the payment (to see the failure and retry screen)"]] as const).map(([v, label]) => (
                      <label key={v} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
                        <input type="radio" name="simulate" checked={simulate === v} onChange={() => setSimulate(v)} className="size-4 accent-[var(--color-berry-700)]" />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                </details>
              )}

              <FormError>{formError}</FormError>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" loading={busy} onClick={pay} icon={<Banknote className="size-5" />} className="min-w-[14rem]">Pay {inr(init.confirmation.amount)}</Button>
                <Button size="lg" variant="ghost" disabled={busy} onClick={cancel}>Cancel donation</Button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- failed */}
          {phase === "failed" && result && (
            <div className="max-w-xl" role="alert">
              <SnapThread />
              <p className="mt-4 text-lg text-ink-2">
                The payment was declined. <strong className="font-semibold text-ink">You were not charged and the campaign total did not change.</strong>
              </p>
              {result.failure_reason && <p className="mt-2 text-sm text-ink-3"><span className="folio mr-2">Reason</span>{result.failure_reason}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" loading={busy} onClick={retry}>Try again</Button>
                <ButtonLink to={`/campaigns/${campaign.campaign_id}`} variant="ghost" size="lg">Back to the campaign</ButtonLink>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- done */}
          {phase === "done" && result && (
            <div>
              <TiedThread />
              <p className="mt-4 max-w-xl text-lg text-ink-2">
                Your donation of <strong className="num text-ink">{inrExactStr(result.amount)}</strong> to <strong className="text-ink">{result.campaign_title}</strong> is on the record.
              </p>
              <div className="mt-8">
                {receipt ? <ReceiptSlip receipt={receipt} /> : <Skeleton className="mx-auto h-96 max-w-md" />}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" icon={<Download className="size-5" />} loading={pdfBusy} onClick={downloadPdf}>Download PDF receipt</Button>
                <ButtonLink to={`/donations/${result.donation_id}/receipt`} state={{ token: init?.access_token }} variant="secondary" size="lg" icon={<FileText className="size-5" />}>Open receipt page</ButtonLink>
                <ButtonLink to="/campaigns" variant="ghost" size="lg">Back to causes</ButtonLink>
              </div>
              <p className="mt-4 text-sm text-ink-3">Keep this page or the receipt number. Guests can reopen the receipt with the link from this session.</p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ campaign summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="sheet overflow-hidden">
            <div className="h-36 overflow-hidden border-b border-line"><CauseImage category={campaign.category} /></div>
            <div className="p-5">
              <p className="folio">{campaign.category}</p>
              <h2 className="mt-1 text-2xl leading-tight">{campaign.title}</h2>
              <ThreadProgress percent={campaign.progress_percent} raised={campaign.amount_raised} goal={campaign.goal_amount} size="sm" closed={campaign.status !== "active"} className="mt-5" showNumbers />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
