import { useEffect, useRef, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import type { CampaignOut } from "@/api/types";
import { cn, inr } from "@/lib/format";
import { Skeleton } from "@/ui/States";

/**
 * The hero's expressive moment.
 * One berry thread is stitched through the NGO's real active campaigns (each campaign is an eyelet
 * and a link). The thread leans toward the pointer; on touch devices it drifts on its own.
 * - Motion is derived from three MotionValues, so React never re-renders per frame.
 * - The animation loop only runs while the hero is on screen and is disabled for reduced motion.
 */

const W = 600;
const H = 600;
// [x, y, pointerAmplitudeX, pointerAmplitudeY]. Ends are pinned off-canvas.
const BASE: [number, number, number, number][] = [
  [-30, 70, 0, 0],
  [120, 24, 12, 10],
  [165, 150, 20, 18], // eyelet 1
  [335, 112, 26, 20],
  [445, 305, 30, 24], // eyelet 2
  [335, 398, 26, 22],
  [185, 470, 22, 20], // eyelet 3
  [270, 560, 18, 12],
  [470, 585, 10, 8],
  [650, 505, 0, 0],
];
const EYELETS = [2, 4, 6];

function point(i: number, px: number, py: number, t: number): [number, number] {
  const [x, y, ax, ay] = BASE[i];
  const sway = Math.sin(t / 1900 + i * 0.9);
  const sway2 = Math.cos(t / 2300 + i * 1.3);
  const live = i === 0 || i === BASE.length - 1 ? 0 : 1;
  return [x + live * (px * ax + sway * 5), y + live * (py * ay + sway2 * 6)];
}

// Catmull-Rom spline -> cubic Bezier path through all points
function pathFor(px: number, py: number, t: number): string {
  const p = BASE.map((_, i) => point(i, px, py, t));
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function useEyelet(index: number, px: MotionValue<number>, py: MotionValue<number>, time: MotionValue<number>) {
  const xy = useTransform([px, py, time] as MotionValue<number>[], ([x, y, t]) => point(index, x as number, y as number, t as number));
  const cx = useTransform(xy, (v) => v[0]);
  const cy = useTransform(xy, (v) => v[1]);
  const left = useTransform(cx, (v) => `${(v / W) * 100}%`);
  const top = useTransform(cy, (v) => `${(v / H) * 100}%`);
  return { cx, cy, left, top };
}

const CARD_SIDE: Array<"right" | "left"> = ["right", "left", "right"];

function EyeletCard({ campaign, loading, index, pos }: { campaign: CampaignOut | undefined; loading: boolean; index: number; pos: { left: MotionValue<string>; top: MotionValue<string> } }) {
  const side = CARD_SIDE[index];
  if (!campaign && !loading) return null; // fewer campaigns than eyelets: leave the ring empty
  return (
    <motion.div style={{ left: pos.left, top: pos.top }} className="absolute z-10 size-0">
      <div
        className={cn(
          "absolute top-1/2 w-[8.9rem] -translate-y-1/2 sm:w-[12.5rem]",
          side === "right" ? "left-4 sm:left-5" : "right-4 sm:right-5",
        )}
      >
        {campaign ? (
          <Link
            to={`/campaigns/${campaign.campaign_id}`}
            className="group block rounded-[var(--radius-md)] border border-line-strong bg-paper/95 px-2.5 py-2 shadow-[var(--shadow-sheet)] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-berry-500 sm:px-3.5 sm:py-3"
          >
            <span className="folio block !text-[0.62rem] sm:!text-[0.68rem]">{campaign.category}</span>
            <span className="mt-0.5 line-clamp-2 block font-display text-[0.86rem] leading-tight font-semibold text-ink sm:text-[1.02rem]">{campaign.title}</span>
            <span className="num mt-1 hidden text-[0.66rem] text-ink-2 sm:block sm:text-xs">
              {inr(campaign.amount_raised)} <span className="text-ink-3">of {inr(campaign.goal_amount)}</span>
            </span>
            <span className="mt-1.5 hidden h-[3px] overflow-hidden rounded-full bg-blush-200 sm:block">
              <span className="block h-full rounded-full bg-berry-700" style={{ width: `${Math.min(100, campaign.progress_percent)}%` }} />
            </span>
          </Link>
        ) : (
          <Skeleton className="h-[3.4rem] w-full sm:h-[5.6rem]" />
        )}
      </div>
    </motion.div>
  );
}

export function ThreadHero({ campaigns, loading, className }: { campaigns: CampaignOut[]; loading: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { margin: "100px" });

  // pointer influence (-1..1), eased with a spring; time drives the idle drift
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const px = useSpring(tx, { stiffness: 70, damping: 15, mass: 0.9 });
  const py = useSpring(ty, { stiffness: 70, damping: 15, mass: 0.9 });
  const time = useMotionValue(0);

  useEffect(() => {
    if (reduce || !inView) return; // pause entirely when off-screen or reduced motion
    let id = 0;
    const loop = (now: number) => {
      time.set(now);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [inView, reduce, time]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    tx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    ty.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => { tx.set(0); ty.set(0); };

  const d = useTransform([px, py, time] as MotionValue<number>[], ([x, y, t]) => pathFor(x as number, y as number, t as number));
  const e0 = useEyelet(EYELETS[0], px, py, time);
  const e1 = useEyelet(EYELETS[1], px, py, time);
  const e2 = useEyelet(EYELETS[2], px, py, time);
  const eyelets = [e0, e1, e2];

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("relative mx-auto w-full max-w-[38rem] touch-pan-y select-none", className)} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true" focusable="false">
        {/* soft shadow thread for depth */}
        <motion.path d={d} transform="translate(5 8)" fill="none" stroke="#efbfc8" strokeWidth={7} strokeLinecap="round" opacity={0.55}
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1], delay: 0.25 }} />
        <motion.path d={d} fill="none" stroke="#861a45" strokeWidth={3.2} strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1], delay: 0.25 }} />
        {eyelets.map((e, i) => (
          <g key={i}>
            <motion.circle cx={e.cx} cy={e.cy} r={13} fill="#fff9f8" stroke="#efbfc8" strokeWidth={7} />
            <motion.circle cx={e.cx} cy={e.cy} r={9} fill="#fff9f8" stroke="#861a45" strokeWidth={3.2} />
          </g>
        ))}
      </svg>

      {eyelets.map((e, i) => (
        <EyeletCard key={i} index={i} loading={loading} campaign={loading ? undefined : campaigns[i]} pos={e} />
      ))}

      {!loading && campaigns.length === 0 && (
        <p className="absolute inset-x-0 bottom-2 text-center text-sm text-ink-3">New campaigns will be stitched in here as soon as they go live.</p>
      )}
    </div>
  );
}
