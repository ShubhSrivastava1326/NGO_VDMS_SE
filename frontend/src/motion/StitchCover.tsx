import { useMemo } from "react";
import { cn } from "@/lib/format";

// Deterministic generative artwork: every campaign gets its own embroidery-style cover derived from
// its id and category. It is decoration only, never presented as a photo of real beneficiaries.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

type Kind = "education" | "health" | "food" | "nature" | "relief" | "generic";
const kindOf = (category: string): Kind => {
  const c = category.toLowerCase();
  if (/educ|school|learn/.test(c)) return "education";
  if (/health|medic|clinic/.test(c)) return "health";
  if (/food|nutri|meal|hunger/.test(c)) return "food";
  if (/environ|green|tree|plant|climate/.test(c)) return "nature";
  if (/disaster|relief|flood|emergen/.test(c)) return "relief";
  return "generic";
};

const BG: Record<Kind, string> = {
  education: "#fdeaec", health: "#e8f4f2", food: "#fff4e0", nature: "#eef5ea", relief: "#f8d9de", generic: "#fff3f3",
};
const INK: Record<Kind, string> = {
  education: "#962554", health: "#1f7a74", food: "#a35d00", nature: "#3d7a3a", relief: "#861a45", generic: "#962554",
};

interface Stroke { d: string; w?: number; solid?: boolean; o?: number }

function build(kind: Kind, r: () => number): Stroke[] {
  const s: Stroke[] = [];
  const W = 400, H = 240;
  switch (kind) {
    case "education": {
      for (let i = 0; i < 7; i++) s.push({ d: `M0 ${40 + i * 28} H${W}`, o: 0.55 });
      s.push({ d: `M78 0 V${H}`, solid: true, w: 2.4 });
      for (let i = 0; i < 9; i++) {
        const x = 120 + r() * 240, y = 40 + Math.floor(r() * 6) * 28 - 8;
        s.push({ d: `M${x} ${y} l9 9 M${x + 9} ${y} l-9 9`, solid: true, w: 2, o: 0.8 });
      }
      const rx = 300 + r() * 40;
      s.push({ d: `M${rx} 0 V74 l10 -10 l10 10 V0`, solid: true, w: 2.4 });
      break;
    }
    case "health": {
      for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 4; gy++) {
        if (r() < 0.45) continue;
        const x = 40 + gx * 56, y = 36 + gy * 56;
        s.push({ d: `M${x - 7} ${y} h14 M${x} ${y - 7} v14`, solid: true, w: 2, o: 0.65 });
      }
      const cx = 150 + r() * 100, cy = 110 + r() * 20;
      s.push({ d: `M${cx - 34} ${cy} h68 M${cx} ${cy - 34} v68`, w: 7 });
      s.push({ d: `M${cx - 50} ${cy} a50 50 0 1 0 100 0 a50 50 0 1 0 -100 0`, o: 0.5 });
      break;
    }
    case "food": {
      const cx = 140 + r() * 120;
      for (let i = 0; i < 4; i++) s.push({ d: `M${cx - 120 + i * 14} 150 a${120 - i * 14} ${80 - i * 8} 0 0 0 ${240 - i * 28} 0`, o: 1 - i * 0.18 });
      for (let i = 0; i < 26; i++) {
        const x = cx - 80 + r() * 160, y = 40 + r() * 80;
        s.push({ d: `M${x} ${y} l3 3`, solid: true, w: 3.6, o: 0.7 });
      }
      break;
    }
    case "nature": {
      const sx = 130 + r() * 140;
      s.push({ d: `M${sx} ${H} C${sx - 12} 160 ${sx + 14} 110 ${sx} 40`, solid: true, w: 2.6 });
      for (let i = 0; i < 6; i++) {
        const y = 200 - i * 28, dir = i % 2 ? 1 : -1, l = 46 + r() * 20;
        s.push({ d: `M${sx} ${y} q${dir * l * 0.6} -${l * 0.8} ${dir * l} -${l * 0.2} q-${dir * l * 0.3} ${l * 0.6} -${dir * l} ${l * 0.2}`, o: 0.9 });
      }
      for (let i = 0; i < 6; i++) s.push({ d: `M${r() * W} ${H - 10 - r() * 20} h${14 + r() * 20}`, o: 0.5 });
      break;
    }
    case "relief": {
      for (let i = 0; i < 6; i++) {
        const y = 50 + i * 30, a = 10 + r() * 8;
        // one quadratic arch, then smooth reflections: a continuous wave across the cover
        s.push({ d: `M-10 ${y} q25 ${-a} 50 0${" t50 0".repeat(8)}`, o: 1 - i * 0.1 });
      }
      s.push({ d: `M${60 + r() * 200} 56 l30 -22 l30 22 v34 h-60 z`, solid: true, w: 2.4 });
      break;
    }
    default: {
      for (let i = 0; i < 6; i++) {
        const y = 36 + i * 34 + r() * 10;
        s.push({ d: `M-10 ${y} Q100 ${y - 30 + r() * 20} 200 ${y} T410 ${y}`, o: 0.9 - i * 0.1 });
      }
      s.push({ d: `M${r() * 380} 20 l8 8 m0 -8 l-8 8`, solid: true, w: 2.4 });
    }
  }
  return s;
}

export function StitchCover({ seed, category, className, label }: { seed: number | string; category: string; className?: string; label?: string }) {
  const kind = kindOf(category);
  const strokes = useMemo(() => build(kind, rng(hashStr(`${seed}:${category}`))), [kind, seed, category]);
  const ink = INK[kind];
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className={cn("stitch-run h-full w-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="400" height="240" fill={BG[kind]} />
      {strokes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          data-stitch={s.solid ? undefined : ""}
          fill="none"
          stroke={ink}
          strokeWidth={s.w ?? 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.solid ? undefined : "6 6"}
          opacity={s.o ?? 1}
        />
      ))}
    </svg>
  );
}
