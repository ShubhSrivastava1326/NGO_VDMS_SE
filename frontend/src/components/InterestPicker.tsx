import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/format";

/** Multi-select chips from the API's suggestions, plus free text (the API accepts any interest). */
export function InterestPicker({ value: given, onChange, suggestions, error }: {
  value: string[] | undefined; onChange: (v: string[]) => void; suggestions: string[]; error?: string;
}) {
  const value = given ?? []; // react-hook-form hands over undefined until `values` has been applied
  const id = useId();
  const [draft, setDraft] = useState("");
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  const all = [...new Set([...suggestions, ...value])];

  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="text-sm font-semibold">Areas of interest</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((s) => {
          const on = value.includes(s);
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => toggle(s)}
              className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold capitalize transition-colors",
                on ? "border-berry-700 bg-berry-700 text-white" : "border-line-strong bg-white text-ink-2 hover:border-berry-700 hover:text-berry-700")}>
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`${id}-other`}>Add another interest</label>
        <input id={`${id}-other`} className="input" placeholder="Something else? Type it here" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} maxLength={60} />
        <button type="button" onClick={add} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-berry-700 px-4 text-sm font-semibold text-berry-700 hover:bg-blush-100">
          <Plus className="size-4" aria-hidden="true" />Add
        </button>
      </div>
      {error && <p id={`${id}-err`} className="mt-1.5 text-[0.82rem] font-medium text-danger-600">{error}</p>}
    </fieldset>
  );
}
