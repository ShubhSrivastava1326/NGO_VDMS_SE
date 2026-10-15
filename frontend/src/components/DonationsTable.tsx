import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import type { DonationOut } from "@/api/types";
import { fmtDateTime, inrExactStr, paymentLabel } from "@/lib/format";
import { StatusPill } from "@/ui/Badge";

/** Ledger table of donations. Failed attempts are listed but are visibly not part of any total. */
export function DonationsTable({ rows, showDonor, showCampaign = true }: { rows: DonationOut[]; showDonor?: boolean; showCampaign?: boolean }) {
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th scope="col">Date</th>
          {showCampaign && <th scope="col">Campaign</th>}
          {showDonor && <th scope="col">Donor</th>}
          <th scope="col">Method</th>
          <th scope="col">Status</th>
          <th scope="col" className="r">Amount</th>
          <th scope="col"><span className="sr-only">Receipt</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.donation_id}>
            <td data-label="Date" className="num whitespace-nowrap text-[0.85rem]">{fmtDateTime(d.completed_at ?? d.donation_date)}</td>
            {showCampaign && <td data-label="Campaign"><Link className="font-semibold hover:text-berry-700 hover:underline" to={`/campaigns/${d.campaign_id}`}>{d.campaign_title}</Link></td>}
            {showDonor && <td data-label="Donor"><Link className="hover:text-berry-700 hover:underline" to={`/admin/donors/${d.donor_id}`}>{d.donor_name}</Link></td>}
            <td data-label="Method">{paymentLabel(d.payment_method)}</td>
            <td data-label="Status">
              <div className="flex flex-col items-end gap-1 md:items-start">
                <StatusPill status={d.status} />
                {d.status === "failed" && d.failure_reason && <span className="max-w-[16rem] text-xs text-ink-3">{d.failure_reason}</span>}
              </div>
            </td>
            <td data-label="Amount" className={d.status === "completed" ? "num r font-medium" : "num r text-ink-3 line-through decoration-1"}>
              {inrExactStr(d.amount)}
            </td>
            <td data-label="" className="r">
              {d.status === "completed" && (
                <Link to={`/donations/${d.donation_id}/receipt`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-berry-700 hover:bg-blush-100">
                  <FileText className="size-4" aria-hidden="true" />Receipt
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
