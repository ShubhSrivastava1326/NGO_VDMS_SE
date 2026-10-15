import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/format";

/** Password input with a show/hide toggle (a real button, keyboard and screen-reader friendly). */
export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(
  function PasswordField({ label, error, hint, className, ...rest }, ref) {
    const auto = useId();
    const id = rest.id ?? auto;
    const [show, setShow] = useState(false);
    const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className={cn("space-y-1.5", className)}>
        <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? "text" : "password"}
            className="input pr-12"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-blush-100 hover:text-berry-700"
          >
            {show ? <EyeOff className="size-[1.1rem]" /> : <Eye className="size-[1.1rem]" />}
          </button>
        </div>
        {hint && !error && <p id={`${id}-hint`} className="text-[0.82rem] text-ink-3">{hint}</p>}
        {error && <p id={`${id}-err`} className="text-[0.82rem] font-medium text-danger-600">{error}</p>}
      </div>
    );
  },
);

/** Mirrors the server's password rule: 8+ characters, at least one letter and one digit. */
export const passwordRules = {
  required: "Choose a password",
  validate: (v: string) => {
    if (v.length < 8) return "Use at least 8 characters";
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Include at least one letter and one digit";
    if (new TextEncoder().encode(v).length > 72) return "That password is too long (72 bytes max)";
    return true;
  },
};
