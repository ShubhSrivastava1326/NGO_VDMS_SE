import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { metaApi } from "@/api/services";

/** Sets document.title; restores nothing on unmount because the next page sets its own. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | Helping Hands` : "Helping Hands";
  }, [title]);
}

/** GET /meta/config (enums, limits, suggestion lists). Cached for the whole session. */
export function useMeta() {
  return useQuery({ queryKey: ["meta", "config"], queryFn: metaApi.config, staleTime: Infinity, gcTime: Infinity });
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** true on devices whose primary input can hover (mouse); false on touch-only. */
export function useCanHover(): boolean {
  const [can, setCan] = useState(() => (typeof window === "undefined" ? false : window.matchMedia("(hover: hover)").matches));
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    const on = () => setCan(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return can;
}

/** Keep the latest callback without re-subscribing effects. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Donation access tokens live in sessionStorage so a refresh on the confirm step doesn't lose them. */
export const donationTokens = {
  get: (id: number): string | null => {
    try { return sessionStorage.getItem(`donation:${id}`); } catch { return null; }
  },
  set: (id: number, token: string) => {
    try { sessionStorage.setItem(`donation:${id}`, token); } catch { /* ignore */ }
  },
};
