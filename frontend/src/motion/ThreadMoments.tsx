import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { ReceiptOut } from "@/api/types";
import { cn, fmtDateTime, inrExactStr, paymentLabel } from "@/lib/format";

/** Payment failed: the thread pulls taut and snaps; the two loose ends spring back. */
export function SnapThread({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const t = (d: number) => ({ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : d, ease: [0.22, 1, 0.36, 1] as const });
  return (
    <svg viewBox="0 0 320 70" className={cn("h-16 w-full max-w-xs", className)} role="img" aria-label="A thread that has snapped">
      <motion.path d="M4 35 H150 q6 -2 10 -14" fill="none" stroke="#861a45" strokeWidth="3.2" strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0)} />
      <motion.g
        initial={reduce ? false : { y: 0, rotate: 0 }}
        animate={{ y: [0, -4, 3, -1.5, 0], rotate: [0, -3, 2, -1, 0] }}
        transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.55, ease: "easeOut" }}
        style={{ originX: "316px", originY: "35px" }}
      >
        <motion.path d="M316 35 H178 q-8 2 -12 16" fill="none" stroke="#861a45" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 7"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.1)} />
      </motion.g>
      <circle cx="4" cy="35" r="5" fill="#861a45" />
      <circle cx="316" cy="35" r="5" fill="#fff9f8" stroke="#861a45" strokeWidth="3" />
    </svg>
  );
}

/** Payment completed: the thread draws across, ties off with a bead, and the tick draws in. */
export function TiedThread({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 320 70" className={cn("h-16 w-full max-w-xs", className)} role="img" aria-label="A completed thread, tied off">
      <circle cx="12" cy="35" r="5" fill="#861a45" />
      <motion.path d="M12 35 H250" fill="none" stroke="#861a45" strokeWidth="3.2" strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.8, ease: [0.65, 0, 0.35, 1] }} />
      <motion.circle cx="278" cy="35" r="22" fill="#861a45"
        initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 18, delay: reduce ? 0 : 0.7 }} style={{ originX: "278px", originY: "35px" }} />
      <motion.path d="M267 36 l8 8 l15 -17" fill="none" stroke="#fff9f8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 1.0 }} />
    </svg>
  );
}

const Row = ({ k, children, strong }: { k: string; children: ReactNode; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-6 border-b border-dashed border-blush-300 py-2.5">
    <dt className="folio shrink-0">{k}</dt>
    <dd className={cn("num min-w-0 break-words text-right text-[0.92rem]", strong && "font-medium text-ink")}>{children}</dd>
  </div>
);

/**
 * The receipt as a printed slip: it "prints" downward out of a slot, and its lower edge is perforated.
 * Content is the API's receipt, unchanged. Under reduced motion it simply appears.
 */
export function ReceiptSlip({ receipt, className }: { receipt: ReceiptOut; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      aria-label={`Receipt ${receipt.receipt_number}`}
      className={cn("relative mx-auto w-full max-w-md bg-white px-6 pb-12 pt-7 shadow-[var(--shadow-pop)]", className)}
      style={{
        WebkitMaskImage: "radial-gradient(circle at 10px 100%, transparent 7px, #000 7.5px)",
        maskImage: "radial-gradient(circle at 10px 100%, transparent 7px, #000 7.5px)",
        WebkitMaskSize: "20px 100%",
        maskSize: "20px 100%",
        WebkitMaskRepeat: "repeat-x",
        maskRepeat: "repeat-x",
        WebkitMaskPosition: "bottom",
        maskPosition: "bottom",
      }}
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0)", y: -18 }}
      animate={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
      transition={{ duration: reduce ? 0 : 1.15, ease: [0.45, 0, 0.2, 1] }}
    >
      <header className="text-center">
        <p className="folio">Donation receipt</p>
        <h2 className="mt-1 text-[1.7rem]">{receipt.ngo_name}</h2>
        <p className="num mt-1 text-sm font-medium text-berry-700">{receipt.receipt_number}</p>
      </header>
      <div className="stitch-h my-5" aria-hidden="true" />
      <dl>
        <Row k="Date">{fmtDateTime(receipt.donation_date)}</Row>
        <Row k="Donor">{receipt.donor_name}</Row>
        <Row k="Email">{receipt.donor_email}</Row>
        {receipt.pan_tax_id && <Row k="PAN / Tax ID">{receipt.pan_tax_id}</Row>}
        <Row k="Campaign">{receipt.campaign_title}</Row>
        <Row k="Method">{paymentLabel(receipt.payment_method)}</Row>
        {receipt.payment_reference && <Row k="Reference">{receipt.payment_reference}</Row>}
      </dl>
      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="folio">Amount ({receipt.currency})</p>
        <p className="display text-[2.4rem] tabular-nums text-berry-800">{inrExactStr(receipt.amount)}</p>
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs text-ink-3">
        <Check className="mt-0.5 size-3.5 shrink-0 text-teal-600" aria-hidden="true" />
        Simulated payment for demonstration. No money was charged.
      </p>
    </motion.article>
  );
}
