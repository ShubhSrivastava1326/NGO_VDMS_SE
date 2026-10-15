import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { ApiError } from "@/api/client";
import { donationApi } from "@/api/services";
import { useAuth } from "@/auth/AuthContext";
import { donationTokens, usePageTitle } from "@/lib/hooks";
import { ReceiptSlip } from "@/motion/ThreadMoments";
import { Button, ButtonLink } from "@/ui/Button";
import { ErrorState, Skeleton } from "@/ui/States";
import { useToast } from "@/ui/Toast";

/** Receipt for a completed donation: owner (logged in), admin, or a guest holding the donation token. */
export default function Receipt() {
  const { id = "" } = useParams();
  const did = Number(id);
  const loc = useLocation();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const token = (loc.state as { token?: string } | null)?.token ?? sp.get("token") ?? donationTokens.get(did);
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["receipt", did, !!token], queryFn: () => donationApi.receipt(did, token), retry: false });
  usePageTitle(q.data ? `Receipt ${q.data.receipt_number}` : "Receipt");

  const download = async () => {
    setBusy(true);
    try { await donationApi.downloadReceiptPdf(did, token, `${q.data?.receipt_number ?? "receipt"}.pdf`); }
    catch (e) { toast.fail(e); } finally { setBusy(false); }
  };

  const denied = q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403);

  return (
    <div className="container-page pb-20 pt-10 lg:pt-14">
      <p className="folio">Receipt</p>
      <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">Your <span className="emph">receipt</span></h1>

      <div className="mt-10">
        {q.isLoading && <Skeleton className="mx-auto h-[28rem] max-w-md" />}
        {denied && (
          <div role="alert" className="sheet mx-auto max-w-md p-8 text-center">
            <h2 className="text-2xl">You can't open this receipt from here</h2>
            <p className="mt-2 text-ink-2">
              {user ? "This receipt belongs to a different account." : "Sign in with the account that made this donation, or use the link from the donation session."}
            </p>
            {!user && <ButtonLink to="/login" state={{ from: loc.pathname }} className="mt-5">Sign in</ButtonLink>}
          </div>
        )}
        {q.isError && !denied && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <ReceiptSlip receipt={q.data} />
            <div className="no-print mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-3">
              <Button icon={<Download className="size-4" />} loading={busy} onClick={download}>Download PDF</Button>
              <Button variant="secondary" onClick={() => window.print()}>Print</Button>
              <Link to={user ? (user.role === "donor" ? "/donor/donations" : "/") : "/campaigns"} className="inline-flex min-h-11 items-center px-4 font-semibold text-berry-700 hover:underline">Back</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
