import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { CampaignOut } from "@/api/types";
import { CauseImage } from "@/components/CauseImage";
import { motion, useReducedMotion } from "motion/react";
import { daysLeftLabel, inr } from "@/lib/format";
import { ThreadProgress } from "@/ui/ThreadProgress";

const closedText = (c: CampaignOut) =>
  c.closed_reason === "goal_reached" ? "Goal reached" : c.closed_reason === "end_date_passed" ? "Ended" : "Closed";

/** Photo-led campaign card, shared by the landing page and the causes directory. */
export function CampaignCard({ campaign: c, heading = "h2" }: { campaign: CampaignOut; heading?: "h2" | "h3" }) {
  const closed = c.status === "closed";
  const reduce = useReducedMotion();
  const Heading = heading;
  return (
    <Link
      to={`/campaigns/${c.campaign_id}`}
      className="cause-card group"
    >
      <div className="cause-card-image">
        <CauseImage category={c.category} />
        <span className="cause-card-tag">{c.category}</span>
        <span className="cause-card-arrow"><ArrowRight size={20} aria-hidden="true" /></span>
      </div>
      <div className="cause-card-body">
        <Heading>{c.title}</Heading>
        <p className="cause-card-description">{c.description}</p>
        <div className="mt-auto pt-6">
          <p className="cause-card-numbers">
            <span><strong>{inr(c.amount_raised)}</strong> raised</span>
            <span>of {inr(c.goal_amount)}</span>
          </p>
          <div className="funding-track" role="progressbar" aria-label={`${c.title} funding progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, c.progress_percent))}>
            <motion.span initial={{ width: reduce ? `${c.progress_percent}%` : "0%" }} whileInView={{ width: `${Math.min(100, Math.max(0, c.progress_percent))}%` }} viewport={{ once: true }} transition={{ duration: reduce ? 0 : 1.3, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <div className="cause-card-bottom"><span>View campaign <ArrowRight size={16} aria-hidden="true" /></span><small>{closed ? closedText(c) : daysLeftLabel(c.end_date)}</small></div>
        </div>
      </div>
    </Link>
  );
}

/** Ledger row (home page): a ruled line per campaign instead of yet another card. */
export function CampaignRow({ campaign: c, index }: { campaign: CampaignOut; index: number }) {
  return (
    <Link
      to={`/campaigns/${c.campaign_id}`}
      className="group grid items-center gap-x-8 gap-y-3 border-t border-line-strong py-6 transition-colors hover:bg-blush-50 md:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1fr)_auto] md:px-3"
    >
      <span className="num hidden text-sm text-ink-3 md:block">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <p className="folio">{c.category} · {daysLeftLabel(c.end_date)}</p>
        <h3 className="mt-1 text-[clamp(1.4rem,2.4vw,2rem)] leading-tight group-hover:text-berry-800">{c.title}</h3>
      </div>
      <div>
        <ThreadProgress percent={c.progress_percent} raised={c.amount_raised} goal={c.goal_amount} size="sm" label={`${c.title} funding progress`} />
        <p className="num mt-2 flex justify-between text-sm">
          <span className="font-medium">{inr(c.amount_raised)}</span>
          <span className="text-ink-3">of {inr(c.goal_amount)}</span>
        </p>
      </div>
      <span className="hidden size-11 place-items-center rounded-full border border-line-strong text-berry-700 transition-all group-hover:border-berry-700 group-hover:bg-berry-700 group-hover:text-white md:grid">
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
