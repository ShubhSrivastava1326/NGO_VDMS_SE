import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "motion/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** Keep touch, keyboard and modal scrolling native; gently ease desktop wheels. */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
      anchors: { offset: -100 },
      prevent: (node) => node.closest("dialog, [data-native-scroll]") !== null,
    });
    return () => lenis.destroy();
  }, [reduce, pathname]);
  return null;
}
