// Display helpers only. Amounts arrive as "1500.00" strings; Number() is used purely for formatting.

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₹1,500" (or "₹1,500.50" when there are paise) */
export const inr = (value: string | number): string => {
  const n = Number(value);
  return Number.isInteger(n) ? inrWhole.format(n) : inrExact.format(n);
};
/** Always two decimals: for ledgers, receipts and reports */
export const inrExactStr = (value: string | number): string => inrExact.format(Number(value));

/** "2026-10-23" -> "23/10/2026" (SRS display format) */
export const fmtDate = (d: string | null | undefined): string =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "";

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const fmtTime = (iso: string): string => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export const monthShort = (iso: string): string => new Date(iso).toLocaleString("en-IN", { month: "short" });
export const dayNum = (iso: string): string => String(new Date(iso).getDate()).padStart(2, "0");
export const weekday = (iso: string): string => new Date(iso).toLocaleString("en-IN", { weekday: "short" });

/** Whole days from today until the end of `end` (a YYYY-MM-DD date); 0 = last day, negative = ended */
export const daysLeft = (end: string): number => {
  const endOfDay = new Date(`${end}T23:59:59`).getTime();
  return Math.ceil((endOfDay - Date.now()) / 86_400_000) - 1;
};

export const daysLeftLabel = (end: string): string => {
  const d = daysLeft(end);
  if (d < 0) return "Ended";
  if (d === 0) return "Last day";
  return d === 1 ? "1 day left" : `${d} days left`;
};

/** <input type="datetime-local"> value -> explicit UTC ISO (the API reads naive datetimes as IST) */
export const localInputToIso = (value: string): string => new Date(value).toISOString();

/** ISO -> value for <input type="datetime-local"> in the browser's timezone */
export const isoToLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const hasPassed = (iso: string): boolean => new Date(iso).getTime() <= Date.now();

export const titleCase = (s: string): string => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const paymentLabel = (m: string): string =>
  ({ card: "Card", upi: "UPI", net_banking: "Net banking" } as Record<string, string>)[m] ?? titleCase(m);

export const cn = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");
