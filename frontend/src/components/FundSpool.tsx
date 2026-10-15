import { motion, useReducedMotion } from "motion/react";
import type { FundReport } from "@/api/types";
import { inrExactStr } from "@/lib/format";

const SHADES = ["#861a45", "#c25a7c", "#1f7a74", "#a35d00", "#6b1437", "#d889a2"];

/**
 * Raised vs. utilized as a single spool: coloured stretches are money already spent (one per category),
 * the stitched remainder is what is still available. All displayed amounts are the API's own strings;
 * the fractions below only size the bars.
 */
export function FundSpool({ report }: { report: FundReport }) {
  const reduce = useReducedMotion();
  const raised = Number(report.total_raised);
  const frac = (amt: string) => (raised > 0 ? Math.max(0, Math.min(1, Number(amt) / raised)) : 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`Raised ${inrExactStr(report.total_raised)}, utilized ${inrExactStr(report.total_utilized)}, remaining ${inrExactStr(report.remaining_balance)}`}
        className="relative flex h-5 w-full overflow-hidden rounded-full border border-line-strong bg-blush-50"
      >
        {report.breakdown.map((b, i) => (
          <motion.div
            key={b.category}
            className="h-full origin-left"
            style={{ background: SHADES[i % SHADES.length], flexBasis: `${frac(b.amount) * 100}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        <div className="stitch-h mx-2 h-[3px] flex-1 self-center" aria-hidden="true" />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-4 border-y border-line py-4">
        <div><dt className="folio">Raised</dt><dd className="num mt-1 text-lg font-medium">{inrExactStr(report.total_raised)}</dd></div>
        <div><dt className="folio">Utilized</dt><dd className="num mt-1 text-lg font-medium text-berry-800">{inrExactStr(report.total_utilized)}</dd></div>
        <div><dt className="folio">Remaining</dt><dd className="num mt-1 text-lg font-medium text-teal-800">{inrExactStr(report.remaining_balance)}</dd></div>
      </dl>

      {report.breakdown.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {report.breakdown.map((b, i) => (
            <li key={b.category} className="flex items-center gap-3 text-[0.95rem]">
              <span className="size-3 shrink-0 rounded-full" style={{ background: SHADES[i % SHADES.length] }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{b.category}</span>
              <span className="num text-sm text-ink-3">{b.entries} {b.entries === 1 ? "entry" : "entries"} · {b.percent_of_utilized}%</span>
              <span className="num w-28 text-right text-sm font-medium">{inrExactStr(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
