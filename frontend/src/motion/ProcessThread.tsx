import { useRef, type ReactNode } from "react";
import { motion, motionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";

// stands in for scroll progress when motion is reduced, so hook order never changes and the thread is fully drawn
const ONE = motionValue(1);

export interface Station { no: string; title: string; body: ReactNode }

/**
 * "How it stays on the record": four stations joined by a thread that is drawn by scrolling.
 * Scroll progress is the only driver (no timers, no loops). Wide screens run the thread left to
 * right, phones run it top to bottom. Under reduced motion the thread is simply fully drawn.
 */
export function ProcessThread({ stations }: { stations: Station[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 78%", "end 62%"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.6 });
  const progress = reduce ? undefined : smooth;
  const n = stations.length;

  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-4 md:gap-8">
      {stations.map((s, i) => (
        <StationItem key={s.no} station={s} index={i} count={n} progress={progress} />
      ))}
    </ol>
  );
}

function StationItem({ station, index, count, progress }: { station: Station; index: number; count: number; progress?: MotionValue<number> }) {
  const from = index / count;
  const to = (index + 1) / count;
  // each station draws the stretch of thread that leads to the next one
  const draw = useTransform(progress ?? ONE, [from, to], [0, 1], { clamp: true });
  const knot = useTransform(progress ?? ONE, [from - 0.04, from + 0.02], [0, 1], { clamp: true });
  const knotBg = useTransform(knot, [0, 1], ["#fff9f8", "#861a45"]);
  const knotBorder = useTransform(knot, [0, 1], ["#d889a2", "#861a45"]);
  const last = index === count - 1;

  return (
    <li className="relative pl-9 md:pl-0 md:pt-9">
      {/* vertical thread (phones) */}
      {!last && (
        <>
          <span className="stitch-v absolute left-[0.72rem] top-5 bottom-[-2.5rem] md:hidden" aria-hidden="true" />
          <motion.span
            aria-hidden="true"
            className="absolute left-[0.65rem] top-5 bottom-[-2.5rem] w-[3px] origin-top rounded-full bg-berry-700 md:hidden"
            style={{ scaleY: progress ? draw : 1 }}
          />
        </>
      )}
      {/* horizontal thread (wide screens) */}
      {!last && (
        <>
          <span className="stitch-h absolute left-5 top-[0.72rem] hidden w-[calc(100%+2rem-1.25rem)] md:block" aria-hidden="true" />
          <motion.span
            aria-hidden="true"
            className="absolute left-5 top-[0.65rem] hidden h-[3px] w-[calc(100%+2rem-1.25rem)] origin-left rounded-full bg-berry-700 md:block"
            style={{ scaleX: progress ? draw : 1 }}
          />
        </>
      )}
      <motion.span
        aria-hidden="true"
        className="absolute left-0 top-0 size-[1.65rem] rounded-full border-[3px] md:top-0"
        style={{ backgroundColor: progress ? knotBg : "#861a45", borderColor: progress ? knotBorder : "#861a45" }}
      />
      <p className="num text-xs text-ink-3">{station.no}</p>
      <h3 className="mt-1 text-[1.55rem]">{station.title}</h3>
      <div className="mt-2 text-[0.98rem] text-ink-2">{station.body}</div>
    </li>
  );
}
