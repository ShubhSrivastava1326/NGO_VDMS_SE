import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

interface ShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
}

/** label + control + hint + inline error, wired with aria-describedby / aria-invalid */
function Shell({ label, error, hint, optional, className, id, children }: ShellProps & { id: string; children: (a: { describedBy?: string; invalid: boolean }) => ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="folio normal-case tracking-normal">Optional</span>}
      </label>
      {children({ describedBy: [hintId, errId].filter(Boolean).join(" ") || undefined, invalid: !!error })}
      {hint && !error && <p id={hintId} className="text-[0.82rem] text-ink-3">{hint}</p>}
      {error && <p id={errId} className="text-[0.82rem] font-medium text-danger-600">{error}</p>}
    </div>
  );
}

type InputProps = ShellProps & InputHTMLAttributes<HTMLInputElement> & { prefixText?: string };

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, error, hint, optional, className, prefixText, ...rest }, ref,
) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {({ describedBy, invalid }) => (
        <div className="relative">
          {prefixText && (
            <span aria-hidden="true" className="num pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-ink-2">{prefixText}</span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn("input", prefixText && "pl-8")}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...rest}
          />
        </div>
      )}
    </Shell>
  );
});

/** Amount input: keeps the value as a string (never a float) and shows the rupee sign. */
export const MoneyField = forwardRef<HTMLInputElement, Omit<InputProps, "prefixText" | "type">>(function MoneyField(props, ref) {
  return <TextField ref={ref} prefixText="₹" inputMode="decimal" autoComplete="off" placeholder="0.00" {...props} />;
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, ShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextAreaField(
  { label, error, hint, optional, className, rows = 4, ...rest }, ref,
) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {({ describedBy, invalid }) => (
        <textarea ref={ref} id={id} rows={rows} className="input resize-y leading-relaxed" aria-invalid={invalid || undefined} aria-describedby={describedBy} {...rest} />
      )}
    </Shell>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, ShellProps & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, optional, className, children, ...rest }, ref,
) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {({ describedBy, invalid }) => (
        <select ref={ref} id={id} className="input" aria-invalid={invalid || undefined} aria-describedby={describedBy} {...rest}>
          {children}
        </select>
      )}
    </Shell>
  );
});

/** Compact select / search used in filter bars (visually-hidden label). */
export function FilterSelect({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{label}</span>
      <select className="input" {...rest}>{children}</select>
    </label>
  );
}

export function SearchInput({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" className="input pl-10" {...rest} />
    </label>
  );
}
